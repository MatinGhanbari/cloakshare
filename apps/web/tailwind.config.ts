import type { Config } from 'tailwindcss';

const config: Config = {
  // Theming strategy for this app is CSS variables swapped by `[data-theme]` on <html>,
  // not the `dark:` variant. Every colour below resolves through a variable.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Every token resolves through a CSS variable so `data-theme` can swap the palette.
        // RGB channel triples keep Tailwind's opacity modifiers working (bg-accent/10).
        background: 'rgb(var(--bg-background) / <alpha-value>)',
        foreground: 'rgb(var(--fg-foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--bg-surface) / <alpha-value>)',
          foreground: 'rgb(var(--fg-foreground) / <alpha-value>)',
        },
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--bg-muted) / <alpha-value>)',
          foreground: 'rgb(var(--fg-muted) / <alpha-value>)',
        },
        hover: 'rgb(var(--bg-hover) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          muted: 'var(--accent-muted)',
          line: 'var(--accent-line)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        border: 'rgb(var(--border-default) / <alpha-value>)',
        'border-subtle': 'rgb(var(--border-subtle) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        input: 'rgb(var(--bg-input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--fg-foreground) / <alpha-value>)',
        },
        warning: 'rgb(var(--warning) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        'text-primary': 'rgb(var(--fg-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--fg-text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--fg-text-tertiary) / <alpha-value>)',
        placeholder: 'rgb(var(--fg-placeholder) / <alpha-value>)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        // Must match the family declared in src/assets/fonts/geist/geist.css.
        // The previous stack said 'Geist Sans', which no @font-face ever declared, so every
        // element using `font-sans` silently fell through to system-ui.
        sans: ['Geist', 'General Sans', 'system-ui', 'sans-serif'],
      },
      /*
       * Shape lock. Use the semantic names in new code:
       *   rounded-panel   -> cards, panels, tables, modals
       *   rounded-control -> buttons, inputs, selects, nav items
       *   rounded-chip    -> badges, tags, status chips
       *   rounded-full    -> avatars, status dots, pills
       * `lg/md/sm` are kept as aliases so pages that were not redesigned keep rendering.
       */
      borderRadius: {
        panel: '12px',
        control: '8px',
        chip: '6px',
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        // Tinted elevation tokens, swapped per theme in index.css.
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)',
        sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
        md: '0 4px 12px rgba(0, 0, 0, 0.5)',
        lg: '0 8px 32px rgba(0, 0, 0, 0.6)',
        // Kept for backwards compatibility; no longer used by the redesigned surfaces.
        glow: '0 0 20px rgba(0, 255, 136, 0.1)',
      },
      transitionTimingFunction: {
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
