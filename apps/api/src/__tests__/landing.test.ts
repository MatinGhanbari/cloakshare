import { describe, it, expect } from 'vitest';
import app from '../index.js';

/**
 * The landing page is the first thing anyone running the project sees, so these guard the two
 * things that would break it silently: the root redirect coming back, and the stats strip losing
 * the data-stat names that the inline script looks up.
 */
describe('Landing page', () => {
  it('serves HTML at / instead of redirecting to the dashboard', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('links to the dashboard and the API reference', async () => {
    const html = await (await app.request('/')).text();
    expect(html).toContain('href="/dashboard/"');
    expect(html).toContain('href="/docs"');
  });

  it('keeps the data-stat names in step with the stats endpoint', async () => {
    const html = await (await app.request('/')).text();
    for (const key of ['documents', 'views', 'viewers']) {
      expect(html).toContain('data-stat="' + key + '"');
    }
  });

  it('still redirects /dashboard to its trailing-slash form', async () => {
    const res = await app.request('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/dashboard/');
  });

  it('ships the theme toggle and its storage key', async () => {
    const html = await (await app.request('/')).text();
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain("localStorage.getItem(KEY)");
  });
});
