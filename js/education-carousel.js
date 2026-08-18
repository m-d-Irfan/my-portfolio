/**
 * Infinite Vertical Carousel for Certifications & Bootcamps
 * 2-second auto-slide from down to up with hover/touch freeze, swipe, wheel & click controls
 */

import { portfolioData } from './data.js';

let currentIndex = 0;
let autoTimer = null;
let isPaused = false;
let touchStartY = 0;
let touchEndY = 0;
let isAnimating = false;

export function initCertificatesCarousel() {
  const stage = document.getElementById('cert-carousel-stage');
  const wrapper = document.getElementById('cert-carousel-wrapper');
  if (!stage || !wrapper) return;

  const trainingData = portfolioData.training || [];
  if (trainingData.length === 0) return;

  // Render slides
  stage.innerHTML = trainingData.map((item, idx) => `
    <div class="cert-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
      <div class="cert-slide-content">
        <div class="timeline-meta" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">${item.dates}</span>
          <span style="font-size: 11px; font-weight: 700; color: var(--color-primary); background: var(--color-primary-soft); padding: 2px 8px; border-radius: var(--radius-full); border: 1px solid var(--border-accent);">
            ${item.provider}
          </span>
        </div>

        <h4 class="education-degree-title" style="font-size: 16px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">
          ${item.title}
        </h4>

        <p class="cert-desc-text" style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px;">
          ${item.description}
        </p>

        ${item.skills && item.skills.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;">
            ${item.skills.map((s) => `<span class="tech-pill">${s}</span>`).join('')}
          </div>
        ` : ''}

        ${item.link ? `
          <div style="margin-top: auto;">
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="cert-verify-link">
              <span>Verified Certificate</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  updateCarouselUi();

  // Start 2-second auto timer
  startAutoTimer();

  // Pause on hover
  wrapper.addEventListener('mouseenter', () => pauseAutoTimer());
  wrapper.addEventListener('mouseleave', () => resumeAutoTimer());

  // Pause & Swipe on touch for Mobile
  wrapper.addEventListener('touchstart', (e) => {
    pauseAutoTimer();
    touchStartY = e.touches[0].clientY;
    touchEndY = touchStartY;
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    touchEndY = e.touches[0].clientY;
  }, { passive: true });

  wrapper.addEventListener('touchend', () => {
    const diffY = touchStartY - touchEndY;
    if (Math.abs(diffY) > 35) {
      if (diffY > 0) {
        // Swiped up -> Next certificate
        goToSlide((currentIndex + 1) % trainingData.length, 'next');
      } else {
        // Swiped down -> Previous certificate
        goToSlide((currentIndex - 1 + trainingData.length) % trainingData.length, 'prev');
      }
    }
    resumeAutoTimer();
  });

  // Windows Mouse Wheel navigation (debounced)
  let wheelTimeout = null;
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (wheelTimeout) return;
    wheelTimeout = setTimeout(() => {
      wheelTimeout = null;
    }, 400);

    if (e.deltaY > 0) {
      goToSlide((currentIndex + 1) % trainingData.length, 'next');
    } else {
      goToSlide((currentIndex - 1 + trainingData.length) % trainingData.length, 'prev');
    }
  }, { passive: false });

  // Buttons navigation
  const prevBtn = document.getElementById('cert-prev-btn');
  const nextBtn = document.getElementById('cert-next-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      goToSlide((currentIndex - 1 + trainingData.length) % trainingData.length, 'prev');
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      goToSlide((currentIndex + 1) % trainingData.length, 'next');
    });
  }

  // Dots navigation
  const dots = document.querySelectorAll('.cert-dot');
  dots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      const targetIdx = parseInt(dot.getAttribute('data-index'), 10);
      if (!isNaN(targetIdx) && targetIdx !== currentIndex) {
        goToSlide(targetIdx, targetIdx > currentIndex ? 'next' : 'prev');
      }
    });
  });
}

function startAutoTimer() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    if (!isPaused) {
      const trainingData = portfolioData.training || [];
      if (trainingData.length > 0) {
        goToSlide((currentIndex + 1) % trainingData.length, 'next');
      }
    }
  }, 2000); // Auto-changes every 2 seconds
}

function pauseAutoTimer() {
  isPaused = true;
}

function resumeAutoTimer() {
  isPaused = false;
}

function goToSlide(newIndex, direction = 'next') {
  if (isAnimating || newIndex === currentIndex) return;
  isAnimating = true;

  const slides = document.querySelectorAll('.cert-slide');
  if (slides.length === 0) {
    isAnimating = false;
    return;
  }

  const oldIndex = currentIndex;
  currentIndex = newIndex;

  slides.forEach((slide, idx) => {
    slide.classList.remove('active', 'slide-in-up', 'slide-in-down', 'slide-out-up', 'slide-out-down');
    if (idx === currentIndex) {
      slide.classList.add('active', direction === 'next' ? 'slide-in-up' : 'slide-in-down');
    } else if (idx === oldIndex) {
      slide.classList.add(direction === 'next' ? 'slide-out-up' : 'slide-out-down');
    }
  });

  updateCarouselUi();

  setTimeout(() => {
    slides.forEach((slide) => {
      slide.classList.remove('slide-in-up', 'slide-in-down', 'slide-out-up', 'slide-out-down');
    });
    isAnimating = false;
  }, 480);
}

function updateCarouselUi() {
  const trainingData = portfolioData.training || [];
  const counter = document.getElementById('cert-counter');
  if (counter) {
    const formattedCurrent = String(currentIndex + 1).padStart(2, '0');
    const formattedTotal = String(trainingData.length).padStart(2, '0');
    counter.textContent = `${formattedCurrent} / ${formattedTotal}`;
  }

  const dots = document.querySelectorAll('.cert-dot');
  dots.forEach((dot, idx) => {
    if (idx === currentIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}
