/**
 * Global Session Context & Intro Loader Orchestrator
 * - Manages entire portfolio data & session state
 * - Preloads assets and displays a cinematic intro loader for a minimum of 3.2 seconds
 * - Persists session status in sessionStorage
 */

import { portfolioData } from './data.js';

class PortfolioSessionContext {
  constructor() {
    this.data = portfolioData;
    this.introFinished = false;
    this.theme = localStorage.getItem('monzurul_portfolio_theme') || 'night';
    this.listeners = new Set();
  }

  init() {
    const hasSeenIntro = sessionStorage.getItem('portfolio_intro_seen');
    if (hasSeenIntro) {
      this.introFinished = true;
      document.body.classList.add('intro-completed');
    } else {
      this.renderIntroLoader();
    }
  }

  renderIntroLoader() {
    const loader = document.createElement('div');
    loader.id = 'session-intro-loader';
    loader.className = 'session-intro-curtain';
    loader.setAttribute('aria-label', 'Loading Monzurul Islam Portfolio');

    loader.innerHTML = `
      <div class="intro-header-bar">
        <span class="intro-live-indicator">
          <span class="intro-live-dot"></span>
          Monzurul Islam · Portfolio
        </span>
        <span class="font-mono text-xs opacity-60">${new Date().getFullYear()}</span>
      </div>

      <div class="intro-center-hero">
        <div class="intro-name-wrapper">
          <h1 class="intro-name-text text-gradient">
            <span class="intro-word">M O N Z U R U L</span>
            <span class="intro-word">I S L A M</span>
          </h1>
        </div>
        <p class="intro-subheading">
          Junior Software Engineer · Full Stack Developer
        </p>

        <div class="intro-progress-track">
          <div id="intro-progress-bar" class="intro-progress-fill"></div>
        </div>
      </div>

      <div class="intro-footer-bar">
        <span class="intro-status-text">INITIALIZING PORTFOLIO SESSION...</span>
        <div class="intro-counter">
          <span id="intro-counter-value">00</span>
          <span class="intro-counter-pct">%</span>
        </div>
      </div>
    `;

    document.body.appendChild(loader);

    // Guaranteed minimum 3.2 seconds duration using performance.now()
    const MIN_DURATION_MS = 3200;
    let startTimestamp = null;
    const progressBar = loader.querySelector('#intro-progress-bar');
    const counterValue = loader.querySelector('#intro-counter-value');

    const updateLoader = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(Math.floor((elapsed / MIN_DURATION_MS) * 100), 100);

      if (progressBar) progressBar.style.width = `${progress}%`;
      if (counterValue) {
        counterValue.textContent = progress < 10 ? `0${progress}` : `${progress}`;
      }

      if (elapsed < MIN_DURATION_MS) {
        requestAnimationFrame(updateLoader);
      } else {
        if (progressBar) progressBar.style.width = '100%';
        if (counterValue) counterValue.textContent = '100';

        // Hold at 100% for 250ms then smoothly slide curtain up
        setTimeout(() => {
          loader.classList.add('slide-up');
          document.body.classList.add('intro-completed');
          this.introFinished = true;
          sessionStorage.setItem('portfolio_intro_seen', 'true');
          window.dispatchEvent(new CustomEvent('intro-finished'));

          setTimeout(() => {
            if (loader.parentNode) {
              loader.parentNode.removeChild(loader);
            }
          }, 800);
        }, 250);
      }
    };

    requestAnimationFrame(updateLoader);
  }

  getData() {
    return this.data;
  }
}

export const sessionContext = new PortfolioSessionContext();
