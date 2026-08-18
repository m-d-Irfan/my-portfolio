/**
 * 3D Coverflow Interactive Project Showcase & Detail Modal
 * - 3-second auto-slide with hover/touch freeze
 * - 3D depth, gesture swipe, and animated transitions
 */

import { portfolioData } from './data.js';

let activeCategory = 'All';
let currentIndex = 0;
let filteredProjects = [];
let projectModalBackdrop = null;
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let isAnimating = false;
let autoSlideTimer = null;
let isPaused = false;

export function initProjects() {
  filteredProjects = getFilteredProjects();
  initFilterTabs();
  renderCoverflowDom();
  createProjectModalDom();
  bindCarouselControls();
  startAutoSlideTimer();

  // Expose to window for command palette
  window.openProjectModal = openProjectModal;
}

function getFilteredProjects() {
  if (activeCategory === 'All') {
    return [...portfolioData.projects];
  }
  return portfolioData.projects.filter((p) => p.category === activeCategory);
}

function initFilterTabs() {
  const filterTabsContainer = document.getElementById('project-filter-tabs');
  if (!filterTabsContainer) return;

  const categories = ['All', 'Full Stack', 'Backend', 'CMS'];

  filterTabsContainer.innerHTML = categories.map((cat) => `
    <button class="filter-tab ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </button>
  `).join('');

  filterTabsContainer.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabsContainer.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.getAttribute('data-category');
      filteredProjects = getFilteredProjects();
      currentIndex = 0;
      renderCoverflowDom();
      startAutoSlideTimer();
    });
  });
}

export function renderCoverflowDom() {
  const stage = document.getElementById('projects-coverflow-stage');
  const dotsTrack = document.getElementById('coverflow-dots-track');
  const hintText = document.getElementById('coverflow-counter-hint');
  if (!stage) return;

  if (filteredProjects.length === 0) {
    stage.innerHTML = `
      <div style="text-align: center; padding: 60px; color: var(--text-muted); width: 100%;">
        No projects found in this category.
      </div>
    `;
    if (dotsTrack) dotsTrack.innerHTML = '';
    if (hintText) hintText.textContent = '0 / 0 · Swipe or click to slide';
    return;
  }

  // Render cards
  stage.innerHTML = filteredProjects.map((project, idx) => {
    const isCenter = idx === currentIndex;
    const isPrev = idx === (currentIndex - 1 + filteredProjects.length) % filteredProjects.length && filteredProjects.length > 1;
    const isNext = idx === (currentIndex + 1) % filteredProjects.length && filteredProjects.length > 1;

    let posClass = 'hidden-card';
    if (isCenter) posClass = 'card-center';
    else if (isPrev) posClass = 'card-prev';
    else if (isNext) posClass = 'card-next';

    // Show top 4 tech tags + count
    const topTech = project.techStack.slice(0, 4);
    const remainingCount = Math.max(0, project.techStack.length - 4);

    return `
      <article class="coverflow-card ${posClass}" data-index="${idx}" data-id="${project.id}">
        <!-- Top Image with Category Tag Overlay -->
        <div class="coverflow-thumb-wrapper">
          <img src="${project.imageSrc}" alt="${project.title}" class="coverflow-thumb" loading="lazy" />
          <span class="coverflow-category-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            ${project.category}
          </span>
        </div>

        <!-- Card Body -->
        <div class="coverflow-body">
          <h3 class="coverflow-title">${project.title}</h3>
          <p class="coverflow-desc">${project.description}</p>

          <!-- Tech Tags -->
          <div class="coverflow-tech-row">
            ${topTech.map((tech) => `
              <span class="coverflow-tech-pill">
                <span class="tech-code-icon">&lt;&gt;</span>
                ${tech}
              </span>
            `).join('')}
            ${remainingCount > 0 ? `
              <span class="coverflow-tech-pill tech-more">+${remainingCount} more</span>
            ` : ''}
          </div>

          <!-- Action Button -->
          <div class="coverflow-actions">
            <button class="coverflow-view-btn view-details-trigger" data-id="${project.id}">
              <span>View Details / More</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Render dots indicator
  if (dotsTrack) {
    dotsTrack.innerHTML = filteredProjects.map((_, idx) => `
      <button class="coverflow-dot ${idx === currentIndex ? 'active' : ''}" data-index="${idx}" aria-label="Go to slide ${idx + 1}"></button>
    `).join('');
  }

  // Update Hint & Counter
  if (hintText) {
    hintText.textContent = `${currentIndex + 1} / ${filteredProjects.length} · Swipe or click to slide`;
  }

  // Bind side card clicks
  stage.querySelectorAll('.coverflow-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.view-details-trigger')) return;
      const idx = parseInt(card.getAttribute('data-index'), 10);
      if (!isNaN(idx) && idx !== currentIndex) {
        goToSlide(idx);
      }
    });
  });

  // Bind Details Button clicks
  stage.querySelectorAll('.view-details-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openProjectModal(id);
    });
  });
}

function updateCardPositions() {
  const stage = document.getElementById('projects-coverflow-stage');
  const dotsTrack = document.getElementById('coverflow-dots-track');
  const hintText = document.getElementById('coverflow-counter-hint');
  if (!stage) return;

  const cards = stage.querySelectorAll('.coverflow-card');
  cards.forEach((card) => {
    const idx = parseInt(card.getAttribute('data-index'), 10);
    card.classList.remove('card-center', 'card-prev', 'card-next', 'hidden-card');

    const isCenter = idx === currentIndex;
    const isPrev = idx === (currentIndex - 1 + filteredProjects.length) % filteredProjects.length && filteredProjects.length > 1;
    const isNext = idx === (currentIndex + 1) % filteredProjects.length && filteredProjects.length > 1;

    if (isCenter) card.classList.add('card-center');
    else if (isPrev) card.classList.add('card-prev');
    else if (isNext) card.classList.add('card-next');
    else card.classList.add('hidden-card');
  });

  if (dotsTrack) {
    dotsTrack.querySelectorAll('.coverflow-dot').forEach((dot, idx) => {
      if (idx === currentIndex) dot.classList.add('active');
      else dot.classList.remove('active');
    });
  }

  if (hintText) {
    hintText.textContent = `${currentIndex + 1} / ${filteredProjects.length} · Swipe or click to slide`;
  }
}

function startAutoSlideTimer() {
  if (autoSlideTimer) clearInterval(autoSlideTimer);
  autoSlideTimer = setInterval(() => {
    if (!isPaused && filteredProjects.length > 1) {
      goToSlide((currentIndex + 1) % filteredProjects.length);
    }
  }, 3000); // Continuous 3 seconds auto-slide
}

function pauseAutoSlide() {
  isPaused = true;
}

function resumeAutoSlide() {
  isPaused = false;
}

function goToSlide(newIndex) {
  if (isAnimating || newIndex === currentIndex || filteredProjects.length <= 1) return;
  isAnimating = true;

  currentIndex = newIndex;
  updateCardPositions();

  setTimeout(() => {
    isAnimating = false;
  }, 380);
}

function bindCarouselControls() {
  const wrapper = document.getElementById('projects-coverflow-wrapper');
  const stage = document.getElementById('projects-coverflow-stage');
  const prevBtn = document.getElementById('coverflow-prev-btn');
  const nextBtn = document.getElementById('coverflow-next-btn');
  const dotsTrack = document.getElementById('coverflow-dots-track');

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (filteredProjects.length > 1) {
        goToSlide((currentIndex - 1 + filteredProjects.length) % filteredProjects.length);
        startAutoSlideTimer();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (filteredProjects.length > 1) {
        goToSlide((currentIndex + 1) % filteredProjects.length);
        startAutoSlideTimer();
      }
    });
  }

  if (dotsTrack) {
    dotsTrack.addEventListener('click', (e) => {
      const dot = e.target.closest('.coverflow-dot');
      if (dot) {
        const targetIdx = parseInt(dot.getAttribute('data-index'), 10);
        if (!isNaN(targetIdx)) {
          goToSlide(targetIdx);
          startAutoSlideTimer();
        }
      }
    });
  }

  // Freeze on Hover over Cards Stage (Desktop)
  if (stage) {
    stage.addEventListener('mouseenter', pauseAutoSlide);
    stage.addEventListener('mouseleave', resumeAutoSlide);
  }

  // Touch Handling & Freeze (Mobile)
  if (wrapper) {
    wrapper.addEventListener('touchstart', (e) => {
      pauseAutoSlide();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchEndX = touchStartX;
      touchEndY = touchStartY;
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;
    }, { passive: true });

    wrapper.addEventListener('touchend', () => {
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;

      // Dominant horizontal swipe detection
      if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
          // Swiped left -> Next project
          goToSlide((currentIndex + 1) % filteredProjects.length);
        } else {
          // Swiped right -> Previous project
          goToSlide((currentIndex - 1 + filteredProjects.length) % filteredProjects.length);
        }
      }
      resumeAutoSlide();
    });

    wrapper.addEventListener('touchcancel', () => {
      resumeAutoSlide();
    });

    // Keyboard Arrow navigation
    wrapper.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSlide((currentIndex - 1 + filteredProjects.length) % filteredProjects.length);
        startAutoSlideTimer();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToSlide((currentIndex + 1) % filteredProjects.length);
        startAutoSlideTimer();
      }
    });
  }
}

function createProjectModalDom() {
  projectModalBackdrop = document.createElement('div');
  projectModalBackdrop.className = 'modal-backdrop no-print';
  projectModalBackdrop.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true">
      <button class="modal-close-btn" id="modal-close-btn" aria-label="Close modal">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div id="modal-project-content"></div>
    </div>
  `;

  document.body.appendChild(projectModalBackdrop);

  projectModalBackdrop.addEventListener('click', (e) => {
    if (e.target === projectModalBackdrop) {
      closeProjectModal();
    }
  });

  const closeBtn = projectModalBackdrop.querySelector('#modal-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeProjectModal);
}

export function openProjectModal(projectId) {
  const project = portfolioData.projects.find((p) => p.id === projectId);
  if (!project || !projectModalBackdrop) return;

  const contentContainer = projectModalBackdrop.querySelector('#modal-project-content');
  if (!contentContainer) return;

  contentContainer.innerHTML = `
    <div style="margin-bottom: 24px;">
      <span class="section-tag" style="margin-bottom: 8px;">${project.category}</span>
      <h2 style="font-size: 1.75rem; font-weight: 800; margin-bottom: 8px;">${project.title}</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;">
        ${project.techStack.map((tech) => `<span class="tech-pill">${tech}</span>`).join('')}
      </div>
      <div style="border-radius: var(--radius-lg); overflow: hidden; aspect-ratio: 16/9; margin-bottom: 20px; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle);">
        <img src="${project.imageSrc}" alt="${project.title}" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
        <a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="flex: 1; min-width: 140px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          Live Application
        </a>
        <a href="${project.githubUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" style="flex: 1; min-width: 140px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
          Client Repo
        </a>
        ${project.githubBackendUrl ? `
          <a href="${project.githubBackendUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" style="flex: 1; min-width: 140px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6M12 19h8"></path></svg>
            Server / API Repo
          </a>
        ` : ''}
      </div>
      
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Key System Highlights</h4>
        <ul style="list-style: disc; padding-left: 20px; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.7;">
          ${(project.bullets || [project.description]).map((b) => `<li style="margin-bottom: 8px;">${b}</li>`).join('')}
        </ul>
      </div>

      <div style="background: var(--bg-surface-raised); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 16px;">
        <h5 style="font-size: 0.85rem; font-weight: 700; font-family: var(--font-mono); color: var(--color-warning); text-transform: uppercase; margin-bottom: 4px;">Technical Challenges</h5>
        <p style="font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.6;">${project.challenges}</p>
      </div>

      <div style="background: var(--bg-surface-raised); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <h5 style="font-size: 0.85rem; font-weight: 700; font-family: var(--font-mono); color: var(--color-primary); text-transform: uppercase; margin-bottom: 4px;">Future Roadmaps</h5>
        <p style="font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.6;">${project.improvements}</p>
      </div>
    </div>
  `;

  projectModalBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

export function closeProjectModal() {
  if (projectModalBackdrop) {
    projectModalBackdrop.classList.remove('open');
  }
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}
