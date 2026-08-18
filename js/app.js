/**
 * Master Application Controller
 * High-performance, modern developer portfolio
 */

import { sessionContext } from './context.js';
import { portfolioData } from './data.js';
import { getSkillSvg } from './icons.js';
import { initTheme } from './theme.js';
import { initToast } from './toast.js';
import { initCommandPalette } from './command-palette.js';
import { initProjects } from './projects.js';
import { initContact } from './contact.js';
import { initCertificatesCarousel } from './education-carousel.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Session Context & Intro Loader (minimum 3s)
  sessionContext.init();

  // Initialize Core Systems
  initTheme();
  initToast();
  initCommandPalette();
  initProjects();
  initContact();
  initCertificatesCarousel();

  // Populate Dynamic Content
  renderMetrics();
  renderCapabilities();
  renderSkills();
  renderCompetitiveProgramming();
  renderEducation();
  renderFooter();

  // Navigation, Animations & Scroll Listeners
  initNavbarScroll();
  initActiveNavObserver();
  initMobileMenu();
  initScrollReveal();
  initBackToTop();
  initHeroRoleRotator();
});

function renderMetrics() {
  const container = document.getElementById('metrics-grid-container');
  if (!container) return;

  container.innerHTML = portfolioData.metrics.map((m, idx) => `
    <div class="metric-card reveal reveal-stagger-${(idx % 4) + 1}">
      <span class="metric-value" ${m.targetNumber !== undefined && m.targetNumber !== null ? `data-target="${m.targetNumber}" data-decimals="${m.decimals || 0}" data-prefix="${m.prefix || ''}" data-suffix="${m.suffix || ''}"` : ''}>${m.targetNumber !== undefined && m.targetNumber !== null ? (m.decimals > 0 ? (0).toFixed(m.decimals) + m.suffix : '0' + m.suffix) : m.value}</span>
      <span class="metric-label">${m.label}</span>
      <span class="metric-sublabel">${m.sublabel}</span>
    </div>
  `).join('');

  initMetricsCounter();
}

function initMetricsCounter() {
  const metricValues = document.querySelectorAll('.metric-value[data-target]');
  if (metricValues.length === 0) return;

  let hasAnimated = false;

  const triggerAnimation = () => {
    if (hasAnimated) return;
    hasAnimated = true;

    metricValues.forEach((el, idx) => {
      const target = parseFloat(el.getAttribute('data-target'));
      const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';

      setTimeout(() => {
        animateCountUp(el, target, 1600, decimals, prefix, suffix);
      }, idx * 120);
    });
  };

  const metricsStrip = document.querySelector('.metrics-strip');
  if (metricsStrip && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          triggerAnimation();
        }
      });
    }, { threshold: 0.15 });

    observer.observe(metricsStrip);
  } else {
    setTimeout(triggerAnimation, 300);
  }
}

function animateCountUp(element, target, duration, decimals = 0, prefix = '', suffix = '') {
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Smooth easeOutExpo curve
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const currentVal = target * ease;

    const formattedVal = decimals > 0 
      ? currentVal.toFixed(decimals) 
      : Math.floor(currentVal).toString();

    element.textContent = `${prefix}${formattedVal}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      const finalVal = decimals > 0 ? target.toFixed(decimals) : target.toString();
      element.textContent = `${prefix}${finalVal}${suffix}`;
    }
  }

  requestAnimationFrame(step);
}

function renderCapabilities() {
  const container = document.getElementById('capabilities-container');
  if (!container) return;

  container.innerHTML = portfolioData.about.capabilities.map((cap, idx) => {
    let iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="12 8 8 12 12 16 16 12 12 8"></polygon></svg>`;
    
    if (cap.icon === 'server') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`;
    } else if (cap.icon === 'database') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`;
    } else if (cap.icon === 'layout') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
    } else if (cap.icon === 'cloud') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>`;
    }

    return `
      <div class="capability-item reveal reveal-stagger-${(idx % 2) + 1}">
        <div class="capability-icon">
          ${iconSvg}
        </div>
        <div>
          <h4 class="capability-title">${cap.title}</h4>
          <p class="capability-desc">${cap.desc}</p>
        </div>
      </div>
    `;
  }).join('');
}

function renderSkills() {
  const container = document.getElementById('skills-category-container');
  if (!container) return;

  container.innerHTML = portfolioData.skills.map((category, idx) => `
    <div class="skill-category-card reveal reveal-stagger-${(idx % 2) + 1}">
      <div class="skill-category-header">
        <div class="skill-category-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </div>
        <div>
          <h3 class="skill-category-title">${category.title}</h3>
          <p style="font-size: var(--text-xs); color: var(--text-muted);">${category.description || ''}</p>
        </div>
      </div>

      <div class="skill-items-grid">
        ${category.skills.map((skill, sIdx) => `
          <div class="skill-badge pop-in-item" style="--pop-delay: ${sIdx * 65}ms;" title="${skill.name}">
            ${getSkillSvg(skill.icon)}
            <span class="skill-name">${skill.name}</span>
            <span class="skill-tag">${skill.level}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderCompetitiveProgramming() {
  const container = document.getElementById('cp-grid-container');
  if (!container) return;

  container.innerHTML = portfolioData.competitiveProgramming.map((cp, idx) => `
    <div class="cp-card reveal reveal-stagger-${(idx % 2) + 1}">
      <div>
        <div class="cp-header">
          <div class="cp-platform-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            ${cp.platform}
          </div>
          <span class="cp-badge">${cp.badge}</span>
        </div>
        <div class="cp-username">@${cp.username}</div>
        <p class="cp-desc">${cp.description}</p>
      </div>

      <div>
        <a href="${cp.url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" style="width: 100%; justify-content: center; font-size: var(--text-xs);">
          View ${cp.platform} Profile
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    </div>
  `).join('');
}

function renderEducation() {
  const container = document.getElementById('education-timeline-container');
  if (!container) return;

  container.innerHTML = portfolioData.education.map((edu) => `
    <div class="timeline-item reveal">
      <span class="timeline-dot"></span>
      <div class="timeline-card">
        <div class="timeline-meta">
          <span>${edu.dates}</span>
          <span>${edu.location}</span>
        </div>
        <h4 class="timeline-degree">${edu.degree}</h4>
        <p class="timeline-institution">${edu.institution}</p>
        <span class="timeline-grade-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
          ${edu.grade}
        </span>
        <ul style="list-style: disc; padding-left: 16px; font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.6;">
          ${(edu.highlights || [edu.description]).map((h) => `<li style="margin-bottom: 4px;">${h}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');
}

function renderTraining() {
  const container = document.getElementById('training-timeline-container');
  if (!container) return;

  container.innerHTML = portfolioData.training.map((train) => `
    <div class="timeline-item reveal">
      <span class="timeline-dot"></span>
      <div class="timeline-card">
        <div class="timeline-meta">
          <span>${train.dates}</span>
          <span style="color: var(--color-primary); font-weight: 700;">${train.provider}</span>
        </div>
        <h4 class="timeline-degree">${train.title}</h4>
        <p class="timeline-text" style="margin-bottom: 12px;">${train.description}</p>
        
        ${train.skills ? `
          <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;">
            ${train.skills.map((s) => `<span class="tech-pill">${s}</span>`).join('')}
          </div>
        ` : ''}

        ${train.link ? `
          <a href="${train.link}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-family: var(--font-mono); color: var(--color-primary); font-weight: 700;">
            Verified Certificate
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function renderFooter() {
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function initNavbarScroll() {
  const navbar = document.getElementById('main-navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });
}

function initActiveNavObserver() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const currentId = entry.target.getAttribute('id');
        navLinks.forEach((link) => {
          if (link.getAttribute('href') === `#${currentId}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }, {
    threshold: 0.25,
    rootMargin: '-20% 0px -40% 0px'
  });

  sections.forEach((sec) => observer.observe(sec));
}

function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const menuDrawer = document.getElementById('mobile-drawer');
  const closeBtn = document.getElementById('mobile-drawer-close');
  const links = document.querySelectorAll('.mobile-drawer-link');

  if (!toggleBtn || !menuDrawer) return;

  toggleBtn.addEventListener('click', () => {
    menuDrawer.classList.toggle('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      menuDrawer.classList.remove('open');
    });
  }

  links.forEach((link) => {
    link.addEventListener('click', () => {
      menuDrawer.classList.remove('open');
    });
  });
}

function initScrollReveal() {
  const revealElements = document.querySelectorAll(
    '.reveal, .card, .section-header, .contact-box, .metric-card, .skill-category-card, .cp-card, .timeline-item, .hero-chips-container, #projects'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        if (entry.target.id === 'projects' || entry.target.closest('#projects')) {
          const stage = document.getElementById('projects-coverflow-stage');
          if (stage) stage.classList.add('projects-emerge');
        }
      } else {
        // Reset when scrolled out so animations slightly re-trigger every time for every screen view
        entry.target.classList.remove('active');
        if (entry.target.id === 'projects' || entry.target.closest('#projects')) {
          const stage = document.getElementById('projects-coverflow-stage');
          if (stage) stage.classList.remove('projects-emerge');
        }
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach((el) => {
    el.classList.add('reveal');
    observer.observe(el);
  });
}

function initBackToTop() {
  const btn = document.getElementById('back-to-top-btn');
  const progressRing = document.getElementById('scroll-progress-ring');
  if (!btn) return;

  const handleScroll = () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    // Show after scrolling past hero (~320px)
    if (scrollY > 320) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }

    // Update circular progress stroke
    if (progressRing && scrollHeight > 0) {
      const scrollPercent = Math.min(Math.max(scrollY / scrollHeight, 0), 1);
      const dashoffset = 100 - (scrollPercent * 100);
      progressRing.style.strokeDashoffset = dashoffset.toFixed(1);
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    btn.classList.add('scrolling-up');
    
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    setTimeout(() => {
      btn.classList.remove('scrolling-up');
    }, 650);
  });
}

function initHeroRoleRotator() {
  const rotator = document.getElementById('hero-role-cylinder');
  if (!rotator) return;

  const roles = portfolioData.designations || [
    "Junior Software Engineer",
    "Backend Developer",
    "Full Stack Developer"
  ];

  rotator.innerHTML = roles.map((role, idx) => `
    <span class="hero-role-face ${idx === 0 ? 'role-active' : ''}" data-index="${idx}">
      ${role}
    </span>
  `).join('');

  let currentIdx = 0;
  let isRolling = false;
  let rotatorInterval = null;

  function rollToNext() {
    if (isRolling || roles.length <= 1) return;
    isRolling = true;

    const faces = rotator.querySelectorAll('.hero-role-face');
    const currentFace = faces[currentIdx];
    const nextIdx = (currentIdx + 1) % roles.length;
    const nextFace = faces[nextIdx];

    // Trigger 3D dice roll down animations
    currentFace.className = 'hero-role-face dice-roll-out';
    nextFace.className = 'hero-role-face dice-roll-in';

    setTimeout(() => {
      currentFace.className = 'hero-role-face';
      nextFace.className = 'hero-role-face role-active';
      currentIdx = nextIdx;
      isRolling = false;
    }, 560);
  }

  function startRotator() {
    if (rotatorInterval) clearInterval(rotatorInterval);
    rotatorInterval = setInterval(rollToNext, 2000); // Roll down every 2 seconds
  }

  // Start 2 seconds after intro completes
  if (sessionStorage.getItem('portfolio_intro_seen') === 'true') {
    setTimeout(startRotator, 1500);
  } else {
    window.addEventListener('intro-finished', () => {
      setTimeout(startRotator, 2000);
    }, { once: true });
    // Safety fallback
    setTimeout(startRotator, 4500);
  }
}
