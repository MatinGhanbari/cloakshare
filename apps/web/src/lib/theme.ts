/**
 * Theme preference for the dashboard.
 *
 * The choice is stored per browser and applied as `data-theme` on <html>, which swaps the
 * CSS variables defined in index.css. 'system' follows the OS setting and tracks changes.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'scrinium_theme';
/** Pre-rebrand key. Read once so an existing choice is not silently reset. */
const LEGACY_STORAGE_KEY = 'cloak_theme';

export function getStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  return pref === 'system' ? systemTheme() : pref;
}

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
}

export function setTheme(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* storage unavailable — the choice still applies for this session */
  }
  applyTheme(pref);
}

/** Apply the stored theme on boot and keep 'system' in step with the OS. */
export function initTheme(): void {
  applyTheme(getStoredTheme());
  const mq = window.matchMedia?.('(prefers-color-scheme: light)');
  mq?.addEventListener?.('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  });
}
