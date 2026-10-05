import type { Config } from 'tailwindcss';

const config: Config = {
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
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        border: 'rgb(var(--border-default) / <alpha-value>)',
        'border-subtle': 'rgb(var(--border-subtle) / <alpha-value>)',
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
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        sans: ['Geist Sans', 'General Sans', 'Satoshi', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
        md: '0 4px 12px rgba(0, 0, 0, 0.5)',
        lg: '0 8px 32px rgba(0, 0, 0, 0.6)',
        glow: '0 0 20px rgba(0, 255, 136, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
