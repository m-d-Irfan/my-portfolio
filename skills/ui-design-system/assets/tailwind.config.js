/* ui-design-system — Tailwind theme bound to the CSS variables in tokens.css.
 *
 * The values live in tokens.css. This file only NAMES them for Tailwind. That
 * is the whole point: restating hex values here gives the project two palettes
 * that drift apart within a week, and breaks runtime theming (a CSS variable
 * can be changed by a theme toggle at runtime; a compiled hex cannot).
 *
 * Tailwind v3: use this file.
 * Tailwind v4: the equivalent is an @theme block in CSS — see the note at the
 * bottom. This project's frontend is on v4, so check before copying.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    // `extend` is deliberate for spacing and screens (keep Tailwind's defaults)
    // but colors are REPLACED, not extended. Leaving Tailwind's palette in
    // place is how `bg-blue-500` ends up next to `bg-accent` in the same
    // codebase, and it is the single strongest generic-UI tell.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      accent: {
        DEFAULT: 'var(--color-accent)',
        soft: 'var(--color-accent-soft)',
        on: 'var(--color-on-accent)',
      },
      primary: 'var(--color-primary)',
      secondary: 'var(--color-secondary)',

      background: 'var(--color-background)',
      surface: {
        DEFAULT: 'var(--color-surface)',
        sunk: 'var(--color-surface-sunk)',
      },

      text: {
        DEFAULT: 'var(--color-text-primary)',
        muted: 'var(--color-text-muted)',
        subtle: 'var(--color-text-subtle)',
      },

      border: {
        DEFAULT: 'var(--color-border)',
        strong: 'var(--color-border-strong)',
      },

      success: {
        DEFAULT: 'var(--color-success)',
        bg: 'var(--color-success-bg)',
      },
      warning: {
        DEFAULT: 'var(--color-warning)',
        bg: 'var(--color-warning-bg)',
      },
      danger: {
        DEFAULT: 'var(--color-danger)',
        bg: 'var(--color-danger-bg)',
      },
      info: {
        DEFAULT: 'var(--color-info)',
        bg: 'var(--color-info-bg)',
      },
    },

    fontFamily: {
      sans: 'var(--font-sans)',
      serif: 'var(--font-serif)',
      mono: 'var(--font-mono)',
    },

    // Size and line-height travel together, so `text-xl` cannot be paired with
    // a leading that was chosen for a different size.
    fontSize: {
      xs: ['var(--text-xs)', { lineHeight: 'var(--leading-xs)' }],
      sm: ['var(--text-sm)', { lineHeight: 'var(--leading-sm)' }],
      base: ['var(--text-base)', { lineHeight: 'var(--leading-base)' }],
      lg: ['var(--text-lg)', { lineHeight: 'var(--leading-lg)' }],
      xl: ['var(--text-xl)', { lineHeight: 'var(--leading-xl)' }],
      '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-2xl)' }],
      '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-3xl)' }],
      '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-4xl)' }],
    },

    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      full: 'var(--radius-full)',
    },

    // Named by intent. `shadow-md` says nothing about what the element is
    // doing; `shadow-floating` says it is above the page and temporary.
    boxShadow: {
      none: 'none',
      resting: 'var(--shadow-resting)',
      raised: 'var(--shadow-raised)',
      floating: 'var(--shadow-floating)',
      overlay: 'var(--shadow-overlay)',
    },

    zIndex: {
      base: 'var(--z-base)',
      sticky: 'var(--z-sticky)',
      dropdown: 'var(--z-dropdown)',
      overlay: 'var(--z-overlay)',
      modal: 'var(--z-modal)',
      toast: 'var(--z-toast)',
    },

    extend: {
      maxWidth: {
        prose: 'var(--container-prose)',
        app: 'var(--container-app)',
        wide: 'var(--container-wide)',
      },
      transitionDuration: {
        // Motion values belong to transitions-dev. These three exist only so a
        // component never needs `duration-[250ms]`; if transitions-dev/_root.css
        // is imported, prefer var(--duration-*) directly.
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
    },
  },
  plugins: [],
};

/* Tailwind v4 equivalent — put this in the global CSS instead of this file:
 *
 *   @import "tailwindcss";
 *   @import "./tokens.css";
 *
 *   @theme {
 *     --color-accent:     var(--color-accent);
 *     --color-surface:    var(--color-surface);
 *     --radius-md:        var(--radius-md);
 *     --shadow-raised:    var(--shadow-raised);
 *   }
 *
 * v4 reads @theme keys directly as utility names, so `--color-accent` becomes
 * `bg-accent` / `text-accent` with no JS config at all. Do not ship both this
 * file and an @theme block — v4 ignores content-scanning config here and the
 * two disagree silently.
 */
