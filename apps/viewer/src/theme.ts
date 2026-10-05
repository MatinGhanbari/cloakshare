/**
 * Theme for the link viewer.
 *
 * The viewer is served from a different origin than the dashboard, so it cannot read the
 * dashboard's preference — browsers scope localStorage per origin. It keeps its own choice,
 * persisted here and applied as `data-theme` on <html>, and falls back to the OS setting.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'cloak_theme';

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** The stored choice, or the OS preference when the viewer has not been switched before. */
export function currentTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable */
  }
  return systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Apply the theme on boot. Returns the theme that was applied. */
export function initTheme(): Theme {
  const theme = currentTheme();
  applyTheme(theme);
  return theme;
}

/** Flip between light and dark, persist the choice, and return the new theme. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'light' ? 'dark' : 'light';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable — still applies for this session */
  }
  applyTheme(next);
  return next;
}

/** Wire the header button and keep its sun/moon icon in step with the active theme. */
export function setupThemeToggle(): void {
  const button = document.getElementById('theme-toggle');
  const sun = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');

  const syncIcon = () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    sun?.classList.toggle('hidden', !isLight);
    moon?.classList.toggle('hidden', isLight);
  };

  syncIcon();
  button?.addEventListener('click', () => {
    toggleTheme();
    syncIcon();
  });
}
