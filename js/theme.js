/**
 * Theme Switcher Module (Dark / Light)
 * Implements ultra-smooth View Transitions API with circular clip-path expansion starting from the trigger button
 */

const THEME_KEY = 'monzurul_portfolio_theme';

export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'night';
  setTheme(savedTheme, false);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      toggleTheme(e);
    });
  }
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'night';
}

export function setTheme(themeName, animate = true) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem(THEME_KEY, themeName);
  updateThemeUi(themeName);
}

export function toggleTheme(event) {
  const current = getCurrentTheme();
  const nextTheme = current === 'night' ? 'light' : 'night';

  let x = window.innerWidth - 60;
  let y = 32;

  const btn = (event && (event.currentTarget || event.target?.closest?.('button'))) || document.getElementById('theme-toggle-btn');
  if (btn && typeof btn.getBoundingClientRect === 'function') {
    const rect = btn.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  } else if (event && event.clientX && event.clientY) {
    x = event.clientX;
    y = event.clientY;
  }

  // Check if browser supports View Transitions API
  if (typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(() => {
      setTheme(nextTheme, false);
    });

    transition.ready.then(() => {
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 700,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    });
  } else {
    // Fallback smooth transition
    document.documentElement.classList.add('theme-transitioning');
    setTheme(nextTheme, false);
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 600);
  }
}

function updateThemeUi(themeName) {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const avatarImg = document.getElementById('hero-avatar-img');

  if (themeToggleBtn) {
    if (themeName === 'night') {
      themeToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
      themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
    } else {
      themeToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
      themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
    }
  }

  const avatarImgs = document.querySelectorAll('#hero-avatar-img, .avatar-img, .avatar-img-mobile');
  avatarImgs.forEach((img) => {
    img.src = themeName === 'light' 
      ? './assets/avatar-light.jpeg' 
      : './assets/avatar-dark.jpeg';
  });
}
