// ============================================
// CLOAK VIEWER — Main Entry Point
// ============================================

import Hls from 'hls.js';
import { TileStream, type PageGeometry, type TileHeader } from './tiles';
import { initTheme, setupThemeToggle } from './theme';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : window.location.origin
    : 'http://localhost:3000');

// DOM elements
const $loading = document.getElementById('loading')!;
const $processing = document.getElementById('processing')!;
const $error = document.getElementById('error')!;
const $gate = document.getElementById('gate')!;
const $viewer = document.getElementById('viewer')!;
const $videoViewer = document.getElementById('video-viewer')!;

// Gate elements
const $gateForm = document.getElementById('gate-form') as HTMLFormElement;
const $emailField = document.getElementById('email-field')!;
const $emailInput = document.getElementById('email-input') as HTMLInputElement;
const $emailError = document.getElementById('email-error')!;
const $passwordField = document.getElementById('password-field')!;
const $passwordInput = document.getElementById('password-input') as HTMLInputElement;
const $passwordError = document.getElementById('password-error')!;
const $credentialsField = document.getElementById('credentials-field')!;
const $nationalIdField = document.getElementById('national-id-field')!;
const $studentIdInput = document.getElementById('student-id-input') as HTMLInputElement;
const $nationalIdInput = document.getElementById('national-id-input') as HTMLInputElement;
const $credentialsError = document.getElementById('credentials-error')!;
const $credentialsForm = document.getElementById('credentials-form') as HTMLFormElement;
const $credentialsSubmit = document.getElementById('credentials-submit') as HTMLButtonElement;
const $gateSubmit = document.getElementById('gate-submit') as HTMLButtonElement;
const $gateError = document.getElementById('gate-error')!;
const $gateTitle = document.getElementById('gate-title')!;
const $gateSubtitle = document.getElementById('gate-subtitle')!;

// Brand elements
const $brandSection = document.getElementById('brand-section')!;
const $brandLogo = document.getElementById('brand-logo') as HTMLImageElement;
const $brandName = document.getElementById('brand-name')!;

// Processing elements
const $processingMessage = document.getElementById('processing-message')!;
const $progressFill = document.getElementById('progress-fill')!;
const $progressText = document.getElementById('progress-text')!;

// Error elements
const $errorTitle = document.getElementById('error-title')!;
const $errorMessage = document.getElementById('error-message')!;

// Viewer elements
const $docName = document.getElementById('doc-name')!;
const $prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
const $nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const $pageInput = document.getElementById('page-input') as HTMLInputElement;
const $pageCount = document.getElementById('page-count')!;
const $pageLoading = document.getElementById('page-loading') as HTMLDivElement;
const $zoomInBtn = document.getElementById('zoom-in-btn') as HTMLButtonElement;
const $zoomOutBtn = document.getElementById('zoom-out-btn') as HTMLButtonElement;
const $zoomFitBtn = document.getElementById('zoom-fit-btn') as HTMLButtonElement;
const $zoomIndicator = document.getElementById('zoom-indicator')!;
const $canvas = document.getElementById('doc-canvas') as HTMLCanvasElement;
const $viewerBody = document.getElementById('viewer-body')!;

// Video viewer elements
const $videoDocName = document.getElementById('video-doc-name')!;
const $videoElement = document.getElementById('video-element') as HTMLVideoElement;
const $videoWatermarkCanvas = document.getElementById('video-watermark-canvas') as HTMLCanvasElement;
const $videoControls = document.getElementById('video-controls')!;
const $videoPlayBtn = document.getElementById('video-play-btn')!;
const $playIcon = document.getElementById('play-icon')!;
const $pauseIcon = document.getElementById('pause-icon')!;
const $videoSeek = document.getElementById('video-seek') as HTMLInputElement;
const $videoTimeCtrl = document.getElementById('video-time-ctrl')!;
const $videoTimeDisplay = document.getElementById('video-time-display')!;
const $videoFullscreenBtn = document.getElementById('video-fullscreen-btn')!;
const $videoQualitySelect = document.getElementById('video-quality-select') as HTMLSelectElement;

// ============================================
// STATE
// ============================================

interface LinkMetadata {
  status: string;
  file_type: string;
  require_email: boolean;
  has_password: boolean;
  requires_credentials?: boolean;
  access_group_name?: string | null;
  allowed_domains: string[] | null;
  page_count: number;
  video_metadata?: {
    duration: number;
    width: number;
    height: number;
    qualities: string[];
  };
  brand_name: string | null;
  brand_color: string | null;
  brand_logo_url: string | null;
  watermark_enabled: boolean;
  show_badge: boolean;
  name: string | null;
  progress_url?: string;
}

interface VerifyResponse {
  session_token: string;
  viewer_email: string;
  pages: { page: number; url: string }[];
  page_count?: number;
  watermark_text: string;
  // Video-specific fields
  master_playlist_url?: string;
  session_manifest?: string;
  segment_sign_url?: string;
  video_metadata?: {
    duration: number;
    width: number;
    height: number;
    qualities: string[];
  };
}

let linkToken = '';
let metadata: LinkMetadata | null = null;
let session: VerifyResponse | null = null;
let currentPage = 1;
let totalPages = 1;
let pageImages: Map<number, HTMLImageElement> = new Map();

// Tile stream state (documents are delivered as WebSocket tiles, not whole-page images)
let tileStream: TileStream | null = null;
/** Geometry of the page currently on screen — always the cache entry for `currentPage`. */
let pageGeo: PageGeometry | null = null;
/**
 * Geometry of every page the server has described, keyed by page number — including pages we
 * only asked for in order to preload them. Retaining it makes navigating to a preloaded page a
 * pure repaint: no round trip, and no reliance on the request de-duplication guard below.
 */
const pageGeometryCache = new Map<number, PageGeometry>();
/**
 * Pages whose tile batch has been fully received. The loading overlay and the navigation lock
 * are both driven by this: until `done` arrives for a page the viewer cannot navigate away from
 * it, so a burst of clicks can never queue up several page changes.
 */
const readyPages = new Set<number>();
/**
 * Pages with a viewport request in flight. Stops the prefetch window from asking for a page twice
 * while its first batch is still on the way, and stops it re-asking for a page it already holds.
 */
const requestedPages = new Set<number>();
/**
 * True while the page on screen is still being fetched. Both page buttons are disabled for the
 * duration, so a burst of clicks cannot queue several page changes behind one another, and the
 * button that started the change carries a spinner so the lock reads as "working", not "broken".
 */
let navigating = false;
/** Which button started the current page change — that is the one that gets the spinner. */
let navDirection: 'prev' | 'next' | null = null;
/** Releases the lock if a page never completes, so a failed fetch cannot trap the viewer. */
let navWatchdog: ReturnType<typeof setTimeout> | null = null;
const NAV_WATCHDOG_MS = 12_000;
let currentScale = 1;
const tileBitmaps = new Map<string, ImageBitmap>(); // `${page}:${col}-${row}` -> bitmap
const tileHeaders = new Map<string, TileHeader>(); // `${page}:${col}-${row}` -> placement
let scrollThrottle: ReturnType<typeof setTimeout> | null = null;
let rateLimitRetries = 0;

// Zoom: a multiplier applied on top of fit-to-width.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
let zoomFactor = 1;
let trackingInterval: ReturnType<typeof setInterval> | null = null;
let pageTimes: Record<number, number> = {};
let pageStartTime = Date.now();
let totalDuration = 0;

// Video state
let hlsInstance: Hls | null = null;
let videoWatchTime = 0;
let videoMaxReached = 0;
let videoLastTrackTime = 0;
let videoWatermarkRaf = 0;

// ============================================
// ROUTING
// ============================================

function getToken(): string | null {
  const path = window.location.pathname;
  // The viewer is mounted under a base path (e.g. /v), so the link id lives at
  // /<base>/s/<id>. Match the trailing /s/<id> segment regardless of the prefix.
  const match = path.match(/\/s\/(.+)$/);
  return match ? match[1] : null;
}

// ============================================
// SCREENS
// ============================================

function showScreen(screen: HTMLElement) {
  [$loading, $processing, $error, $gate, $viewer, $videoViewer].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function showError(title: string, message: string) {
  $errorTitle.textContent = title;
  $errorMessage.textContent = message;
  showScreen($error);
}

// ============================================
// API CALLS
// ============================================

async function fetchMetadata(token: string): Promise<LinkMetadata | null> {
  const res = await fetch(`${API_URL}/v1/viewer/${token}`);
  const json = await res.json();

  if (!res.ok) {
    const err = json.error;
    if (err?.code === 'NOT_FOUND') {
      showError('Document not found', 'This link does not exist or has been removed.');
    } else if (err?.code === 'LINK_EXPIRED') {
      showError('Link expired', 'This document link has expired.');
    } else if (err?.code === 'LINK_REVOKED') {
      showError('Access revoked', 'The sender has revoked access to this document.');
    } else if (err?.code === 'RENDER_FAILED') {
      showError('Processing failed', 'This document could not be processed. The sender has been notified.');
    } else {
      showError('Unavailable', err?.message || 'This document is not available.');
    }
    return null;
  }

  return json.data;
}

/** Result of an access attempt — carries the server's own message so the gate can explain it. */
type VerifyResult =
  | { ok: true; data: VerifyResponse }
  | { ok: false; code: string; message: string };

async function verifyAccess(
  token: string,
  email?: string,
  password?: string,
  credentials?: { student_id: string; national_id: string },
): Promise<VerifyResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/viewer/${token}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(credentials ?? {}) }),
    });
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Could not reach the server. Check your connection and try again.' };
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.data) {
    return {
      ok: false,
      code: json?.error?.code ?? 'UNKNOWN',
      message: json?.error?.message ?? 'Unable to access this document.',
    };
  }

  return { ok: true, data: json.data };
}

async function trackEvent(token: string, sessionToken: string, isFinal = false) {
  // Calculate current page time
  const now = Date.now();
  const elapsed = (now - pageStartTime) / 1000;
  pageTimes[currentPage] = (pageTimes[currentPage] || 0) + elapsed;
  pageStartTime = now;
  totalDuration += elapsed;

  try {
    await fetch(`${API_URL}/v1/viewer/${token}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify({
        current_page: currentPage,
        total_duration: Math.round(totalDuration),
        page_times: pageTimes,
        is_final: isFinal,
      }),
    });
  } catch {
    // Silent fail — tracking is best-effort
  }
}

async function trackVideoEvent(token: string, sessionToken: string, isFinal = false) {
  const currentTime = $videoElement.currentTime;
  const totalDur = $videoElement.duration || 0;

  // Accumulate watch time since last track
  const now = Date.now();
  if (videoLastTrackTime > 0 && !$videoElement.paused) {
    videoWatchTime += (now - videoLastTrackTime) / 1000;
  }
  videoLastTrackTime = now;

  // Track furthest point reached
  if (currentTime > videoMaxReached) {
    videoMaxReached = currentTime;
  }

  try {
    await fetch(`${API_URL}/v1/viewer/${token}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify({
        video_watch_time: Math.round(videoWatchTime),
        video_current_time: Math.round(currentTime),
        video_total_duration: Math.round(totalDur),
        is_final: isFinal,
      }),
    });
  } catch {
    // Silent fail — tracking is best-effort
  }
}

// ============================================
// PROCESSING / SSE PROGRESS
// ============================================

function watchProgress(progressUrl: string) {
  showScreen($processing);

  const evtSource = new EventSource(progressUrl);

  evtSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    $processingMessage.textContent = data.message || 'Processing...';
    $progressFill.style.width = `${data.progress}%`;
    $progressText.textContent = `${data.progress}%`;
  });

  evtSource.addEventListener('complete', (e) => {
    evtSource.close();
    $progressFill.style.width = '100%';
    $progressText.textContent = '100%';
    $processingMessage.textContent = 'Ready!';
    // Reload metadata to get fresh state
    setTimeout(() => init(), 500);
  });

  evtSource.addEventListener('error', (e) => {
    if (e instanceof MessageEvent) {
      const data = JSON.parse(e.data);
      evtSource.close();
      showError('Processing failed', data.error || 'Document could not be processed.');
    }
  });

  evtSource.addEventListener('timeout', () => {
    evtSource.close();
    showError('Timed out', 'Document processing is taking longer than expected. Please refresh.');
  });

  evtSource.onerror = () => {
    evtSource.close();
    // Try reloading after brief pause
    setTimeout(() => init(), 2000);
  };
}

// ============================================
// GATE (EMAIL + PASSWORD)
// ============================================

function setupGate(meta: LinkMetadata) {
  // Branding
  if (meta.brand_name || meta.brand_logo_url) {
    $brandSection.classList.remove('hidden');
    if (meta.brand_logo_url) {
      $brandLogo.src = meta.brand_logo_url;
      $brandLogo.classList.remove('hidden');
    }
    if (meta.brand_name) {
      $brandName.textContent = meta.brand_name;
    }
  }

  // Title
  $gateTitle.innerHTML = meta.name ? `"${meta.name}"` : 'View document';
  $gateSubtitle.innerHTML = meta.requires_credentials
    ? `Sign in with your student ID to open this document
      </br>
      ${
        meta.access_group_name ? `${meta.access_group_name}` : ''
      }.`
    : meta.require_email
      ? 'Enter your email to access this document.'
      : meta.has_password
        ? 'Enter the password to access this document.'
        : 'Click below to view this document.';

  // Group-restricted links swap the whole form: email/password and group credentials are
  // different actions, so each has its own <form>.
  if (meta.requires_credentials) {
    $gateForm.classList.add('hidden');
    $credentialsForm.classList.remove('hidden');
    setTimeout(() => $studentIdInput.focus(), 0);
  } else {
    $credentialsForm.classList.add('hidden');
    if (meta.require_email) {
      $emailField.classList.remove('hidden');
    }
    if (meta.has_password) {
      $passwordField.classList.remove('hidden');
    }
  }

  // Apply brand color
  if (meta.brand_color) {
    $gateSubmit.style.background = meta.brand_color;
  }

  showScreen($gate);
}

// ============================================
// CANVAS RENDERER + WATERMARK
// ============================================

function renderPage(pageNum: number) {
  // Document pages arrive as WebSocket tiles, never as a whole-page image.
  // Geometry is looked up in the cache rather than read off a single "current page" slot, so a
  // page whose geometry arrived during a preload can be painted without asking the server again.
  const geo = pageGeometryCache.get(pageNum) ?? null;
  if (!geo) {
    // Geometry for this page is not known yet — request it; onPage() re-renders.
    // Show the spinner meanwhile so navigation to an unloaded page is visible.
    // Drop the page that was on screen as well: the overlay is opaque and pinned, but the canvas
    // must never be able to show one document page while another one is being loaded.
    clearCanvas();
    requestPageTiles(pageNum);
    updatePageLoading(pageNum);
    return;
  }

  pageGeo = geo;
  const ctx = $canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  // Size canvas to the page aspect, scaled to the container, times the zoom level
  const containerWidth = $viewerBody.clientWidth - 48; // padding
  const fitScale = containerWidth / geo.pageWidth;
  const scale = fitScale * zoomFactor;
  currentScale = scale;
  const displayWidth = geo.pageWidth * scale;
  const displayHeight = geo.pageHeight * scale;

  $canvas.style.width = `${displayWidth}px`;
  $canvas.style.height = `${displayHeight}px`;
  $canvas.width = displayWidth * dpr;
  $canvas.height = displayHeight * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  drawTiles(geo.page);

  // Update navigation
  syncPageInput(pageNum);
  $pageCount.textContent = String(totalPages);
  updateNavButtons();
  updatePageLoading(pageNum);
}

/**
 * Blank the canvas. Used when the page being loaded has no geometry yet, so the previous page can
 * never be visible behind the loading overlay.
 */
function clearCanvas() {
  const ctx = $canvas.getContext('2d');
  if (!ctx) return;
  // The canvas may still carry the device-pixel transform of the previous render.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, $canvas.width, $canvas.height);
}

/** Paint every tile we currently hold for `page` at its scaled position. */
function drawTiles(page: number) {
  const ctx = $canvas.getContext('2d')!;
  ctx.clearRect(0, 0, $canvas.width, $canvas.height);
  const prefix = `${page}:`;
  for (const [key, bitmap] of tileBitmaps) {
    if (!key.startsWith(prefix)) continue;
    const header = tileHeaders.get(key);
    if (!header) continue;
    ctx.drawImage(
      bitmap,
      header.x * currentScale,
      header.y * currentScale,
      header.w * currentScale,
      header.h * currentScale,
    );
  }
}

/** Ask the server for the tiles covering the page (or the visible band, if known). */
let lastRequestKey = '';
let tileDecodeFailures = 0;
function requestPageTiles(page: number, rect?: { x: number; y: number; w: number; h: number }) {
  if (!tileStream) return;
  // Record the page as in flight before the de-duplication guard below, because a request the
  // guard suppresses is one that is already on its way.
  requestedPages.add(page);
  // Skip a request that is effectively the same as the previous one. `goToPage()` clears this
  // key before every deliberate navigation, so the guard can never swallow a page change.
  const key = rect
    ? `${page}:${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(rect.w)}:${Math.round(rect.h)}`
    : `${page}:full`;
  if (key === lastRequestKey) return;
  lastRequestKey = key;

  // For the page being viewed, hold the overlay until the server reports the batch is
  // complete — otherwise the viewer would watch the page assemble tile by tile.
  if (page === currentPage) updatePageLoading(page);
  tileStream.requestPage(page, rect);
}

/** The band of the current page currently visible in the scroll container, in image px. */
function visibleImageRect() {
  const geo = pageGeo;
  if (!geo) return undefined;
  const canvasRect = $canvas.getBoundingClientRect();
  const bodyRect = $viewerBody.getBoundingClientRect();
  if (canvasRect.height <= 0) return undefined;

  const toImage = geo.pageHeight / canvasRect.height;
  const topPx = Math.max(0, bodyRect.top - canvasRect.top);
  const bottomPx = Math.min(canvasRect.height, bodyRect.bottom - canvasRect.top);
  const y = Math.max(0, Math.floor(topPx * toImage));
  const h = Math.max(1, Math.ceil((bottomPx - topPx) * toImage));
  return { x: 0, y, w: geo.pageWidth, h };
}

// ============================================
// LOADING STATE
// ============================================

/**
 * Show the spinner until the page is complete — not merely until the first tile lands, so the
 * viewer never watches the page assemble tile by tile. A page counts as complete once the
 * server has reported its batch as done, and stays complete for the rest of the session.
 */
function updatePageLoading(page: number = currentPage) {
  $pageLoading.hidden = readyPages.has(page);
}

// ============================================
// ZOOM
// ============================================

function updateZoomIndicator() {
  $zoomIndicator.textContent = `${Math.round(zoomFactor * 100)}%`;
}

function applyZoom(next: number) {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  if (Math.abs(clamped - zoomFactor) < 0.001) return;
  zoomFactor = clamped;
  updateZoomIndicator();
  // The whole page is already in memory, so zooming is a pure re-render — no refetch and
  // no spinner, which would otherwise flash on every zoom step.
  if (pageGeo) renderPage(pageGeo.page);
}

function setupZoom() {
  updateZoomIndicator();
  $zoomInBtn.addEventListener('click', () => applyZoom(zoomFactor * ZOOM_STEP));
  $zoomOutBtn.addEventListener('click', () => applyZoom(zoomFactor / ZOOM_STEP));
  $zoomFitBtn.addEventListener('click', () => applyZoom(1));

  // Ctrl/Cmd + wheel zooms, matching the usual document-viewer convention.
  $viewerBody.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      applyZoom(e.deltaY < 0 ? zoomFactor * ZOOM_STEP : zoomFactor / ZOOM_STEP);
    },
    { passive: false },
  );

  document.addEventListener('keydown', (e) => {
    if ($viewer.classList.contains('hidden')) return;
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      applyZoom(zoomFactor * ZOOM_STEP);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      applyZoom(zoomFactor / ZOOM_STEP);
    } else if (e.key === '0') {
      e.preventDefault();
      applyZoom(1);
    }
  });
}

/**
 * How many pages ahead of the reader to keep in hand. Turning the page is instant only when the
 * target page's tiles are already here, so the window has to be deep enough that a reader flipping
 * quickly does not catch up with the prefetch.
 *
 * The window costs almost nothing: each page turn retires one page from the front and fills one
 * new gap at the back, so the steady state is one viewport request per page turned — exactly what
 * prefetching a single page ahead costs — while the reader has PREFETCH_AHEAD pages ready. Only the
 * initial fill of the deeper window is extra, and it is one request.
 */
const PREFETCH_AHEAD = 2;

/**
 * Keep the reader's forward window (page+1 .. page+PREFETCH_AHEAD) loaded.
 *
 * A single call fills only the nearest gap and returns: the page on screen is what the viewer is
 * waiting for, and it should not compete with a stack of speculative requests. Concurrency is
 * bounded by the window itself — at most PREFETCH_AHEAD requests are ever outstanding — and the
 * chain continues from onDone(), which is what advances the window as pages land.
 */
function preloadAdjacentPages(page: number) {
  for (let ahead = 1; ahead <= PREFETCH_AHEAD; ahead++) {
    const target = page + ahead;
    if (target > totalPages) return; // "if the next page exists" — it does not, stop looking
    if (readyPages.has(target) || requestedPages.has(target)) continue; // already here / on its way
    requestPageTiles(target);
    return;
  }
}

/**
 * Fetch a watermarked page on-demand from the server.
 * Used for large documents where only the first pages are pre-loaded.
 */
async function fetchPageOnDemand(pageNum: number) {
  if (!session) return;

  try {
    const response = await fetch(
      `${API_URL}/v1/viewer/${linkToken}/page/${pageNum}`,
      { headers: { 'X-Session-Token': session.session_token } },
    );

    if (!response.ok) return;

    const json = await response.json();
    const url = json.data?.url;
    if (!url) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      pageImages.set(pageNum, img);
      if (currentPage === pageNum) {
        renderPage(pageNum);
      }
    };
    pageImages.set(pageNum, img);
  } catch {
    // Silent fail — page will remain blank until retried
  }
}

// ============================================
// PAGE NAVIGATION
// ============================================

function clearNavWatchdog() {
  if (navWatchdog) {
    clearTimeout(navWatchdog);
    navWatchdog = null;
  }
}

/**
 * Keep the page field showing `page`. An edit in progress wins: while the field has focus the
 * viewer's typing is never overwritten by a re-render (a resize or an arriving tile both
 * re-render, and would otherwise wipe out a half-typed page number).
 */
function syncPageInput(page: number, force = false) {
  if (!force && document.activeElement === $pageInput) return;
  $pageInput.value = String(page);
}

/** Jump to the page number the viewer typed, clamped to the document. */
function commitPageInput() {
  const typed = Number.parseInt($pageInput.value, 10);
  if (!Number.isFinite(typed)) {
    syncPageInput(currentPage, true);
    return;
  }
  const target = Math.min(totalPages, Math.max(1, typed));
  syncPageInput(target, true);
  goToPage(target);
}

/**
 * Reflect the navigation lock in the header: while a page is in flight both arrows are disabled
 * (so clicks cannot stack up) and the one that was pressed shows a spinner.
 */
function updateNavButtons() {
  $prevBtn.disabled = navigating || currentPage <= 1;
  $nextBtn.disabled = navigating || currentPage >= totalPages;
  $prevBtn.classList.toggle('is-loading', navigating && navDirection === 'prev');
  $nextBtn.classList.toggle('is-loading', navigating && navDirection === 'next');
  // The page field is part of the same lock: jumping while a page is still in flight would
  // queue a second page change behind the first.
  $pageInput.disabled = navigating;
}

/**
 * Hold (or release) the page controls while a page change is in flight. The watchdog is the
 * safety valve: a page that never completes — rate limited, or tiles that cannot be decoded —
 * must not leave the viewer permanently unable to turn the page.
 */
function setNavigating(on: boolean, direction: 'prev' | 'next' | null = null) {
  navigating = on;
  navDirection = on ? direction : null;
  clearNavWatchdog();

  if (on) {
    navWatchdog = setTimeout(() => {
      navWatchdog = null;
      if (!navigating) return;
      navigating = false;
      navDirection = null;
      updateNavButtons();
    }, NAV_WATCHDOG_MS);
  }

  updateNavButtons();
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages) return;
  if (page === currentPage) return;
  // A page change is already in flight. Ignoring the click here (as well as disabling the
  // buttons) keeps the keyboard arrows from queueing several page changes at once.
  if (navigating) return;

  const direction: 'prev' | 'next' = page > currentPage ? 'next' : 'prev';

  // Track time on previous page
  const now = Date.now();
  const elapsed = (now - pageStartTime) / 1000;
  pageTimes[currentPage] = (pageTimes[currentPage] || 0) + elapsed;
  totalDuration += elapsed;
  pageStartTime = now;

  currentPage = page;

  // A deliberate page change must always be able to reach the server. The de-duplication guard
  // in requestPageTiles() is keyed only by page + rect, so the preload of this very page would
  // otherwise match the key and the request would be dropped: the canvas stayed blank, the page
  // indicator never moved, and the following click jumped two pages ahead (1 → 3).
  lastRequestKey = '';
  // Geometry is kept per page, so a preloaded page paints immediately instead of being
  // re-requested — and a page we have no geometry for is requested from scratch.
  pageGeo = pageGeometryCache.get(page) ?? null;
  $viewerBody.scrollTop = 0;

  if (readyPages.has(page)) {
    // Already in memory: nothing to wait for, so flip without flashing a spinner.
    setNavigating(false);
  } else {
    setNavigating(true, direction);
  }

  renderPage(currentPage);
  // When the target page was already in memory no viewport request went out, so nothing else
  // would warm the page after it. A duplicate preload is harmless: requestPageTiles() de-dupes it.
  preloadAdjacentPages(page);
}

function setupNavigation() {
  $prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
  $nextBtn.addEventListener('click', () => goToPage(currentPage + 1));

  // The page number is editable: Enter or leaving the field jumps to the typed page, Escape
  // abandons the edit. Arrow-stepping the field deliberately does not navigate — `change` fires
  // on every step, and each step would cost a whole page fetch, while the arrows beside the
  // field already turn pages one at a time.
  $pageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitPageInput();
      $pageInput.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      syncPageInput(currentPage, true);
      $pageInput.blur();
    }
  });
  $pageInput.addEventListener('blur', commitPageInput);

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if ($viewer.classList.contains('hidden')) return;
    // Let the page field handle its own keys — ArrowUp/ArrowDown step its value.
    if (e.target === $pageInput) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      goToPage(currentPage + 1);
    }
  });
}

// ============================================
// DISABLE CONTEXT MENU + DRAG
// ============================================

function setupProtections() {
  $canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  $canvas.addEventListener('dragstart', (e) => e.preventDefault());
  $canvas.style.userSelect = 'none';
  $canvas.style.webkitUserSelect = 'none';
}

// ============================================
// PRELOAD PAGES
// ============================================

function preloadPages(pages: { page: number; url: string }[]) {
  for (const p of pages) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = p.url;
    img.onload = () => {
      pageImages.set(p.page, img);
      // Render first page as soon as it loads
      if (p.page === 1 && currentPage === 1) {
        renderPage(1);
      }
    };
    // Set placeholder even before load
    pageImages.set(p.page, img);
  }
}

// ============================================
// VIDEO VIEWER
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  ctx.save();
  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(128, 128, 128, 0.12)';
  ctx.textAlign = 'center';
  ctx.rotate(-30 * Math.PI / 180);

  const spacingX = 350;
  const spacingY = 120;
  const extX = w * 0.5;
  const extY = h * 0.5;

  for (let y = -extY; y < h + extY; y += spacingY) {
    for (let x = -extX; x < w + extX; x += spacingX) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

function drawVideoWatermark() {
  if (!session?.watermark_text) return;

  const video = $videoElement;
  const canvas = $videoWatermarkCanvas;
  const rect = video.getBoundingClientRect();

  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, rect.width, rect.height);
  drawWatermark(ctx, rect.width, rect.height, session.watermark_text);

  videoWatermarkRaf = requestAnimationFrame(drawVideoWatermark);
}

function setupVideoControls(sess: VerifyResponse, totalDur: number) {
  const video = $videoElement;

  // Play/pause
  $videoPlayBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });

  video.addEventListener('play', () => {
    $playIcon.classList.add('hidden');
    $pauseIcon.classList.remove('hidden');
    videoLastTrackTime = Date.now();
  });

  video.addEventListener('pause', () => {
    $playIcon.classList.remove('hidden');
    $pauseIcon.classList.add('hidden');
    // Accumulate watch time on pause
    if (videoLastTrackTime > 0) {
      videoWatchTime += (Date.now() - videoLastTrackTime) / 1000;
      videoLastTrackTime = 0;
    }
  });

  // Seek bar
  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      $videoSeek.value = String((video.currentTime / video.duration) * 100);
      const timeStr = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
      $videoTimeCtrl.textContent = timeStr;
      $videoTimeDisplay.textContent = timeStr;
      if (video.currentTime > videoMaxReached) {
        videoMaxReached = video.currentTime;
      }
    }
  });

  $videoSeek.addEventListener('input', () => {
    if (video.duration) {
      video.currentTime = (parseFloat($videoSeek.value) / 100) * video.duration;
    }
  });

  // Fullscreen
  $videoFullscreenBtn.addEventListener('click', () => {
    const container = $videoViewer.querySelector('.video-container') as HTMLElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(() => {});
    }
  });

  // Anti-download protections
  video.addEventListener('contextmenu', (e) => e.preventDefault());
  video.disablePictureInPicture = true;
  (video as any).controlsList?.add('nodownload');

  // Auto-hide controls after 3s of inactivity (especially for touch/mobile)
  let controlsTimer: ReturnType<typeof setTimeout> | null = null;
  const container = $videoViewer.querySelector('.video-container') as HTMLElement;

  function showControls() {
    container.classList.add('controls-visible');
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      if (!video.paused) container.classList.remove('controls-visible');
    }, 3000);
  }

  container.addEventListener('mousemove', showControls);
  container.addEventListener('touchstart', showControls, { passive: true });
  video.addEventListener('pause', () => container.classList.add('controls-visible'));
  video.addEventListener('play', showControls);

  // Ended
  video.addEventListener('ended', () => {
    trackVideoEvent(linkToken, sess.session_token, true);
  });
}

function startVideoViewer(meta: LinkMetadata, sess: VerifyResponse) {
  session = sess;
  videoWatchTime = 0;
  videoMaxReached = 0;
  videoLastTrackTime = 0;

  const video = $videoElement;
  $videoDocName.textContent = meta.name || 'Video';
  showScreen($videoViewer);

  // Quality selector
  const qualities = sess.video_metadata?.qualities || meta.video_metadata?.qualities || [];
  $videoQualitySelect.innerHTML = '';
  if (qualities.length > 1) {
    qualities.forEach((q, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = q;
      $videoQualitySelect.appendChild(opt);
    });
    // Default to highest quality
    $videoQualitySelect.value = String(qualities.length - 1);
    $videoQualitySelect.classList.remove('hidden');
  } else {
    $videoQualitySelect.classList.add('hidden');
  }

  // Detect native HLS support (Safari/iOS)
  const hasNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';

  if (hasNativeHls && sess.session_manifest) {
    // Safari/iOS: use session manifest with pre-signed URLs baked in
    const blob = new Blob([sess.session_manifest], { type: 'application/vnd.apple.mpegurl' });
    video.src = URL.createObjectURL(blob);
    video.play().catch(() => {});
  } else if (Hls.isSupported() && sess.master_playlist_url) {
    // HLS.js path — intercept segment requests for signing
    const hls = new Hls({
      xhrSetup: (xhr: XMLHttpRequest, url: string) => {
        // If this is a segment request, sign it
        if (url.includes('.ts') && sess.segment_sign_url) {
          // Extract the segment key from the URL
          const segmentKey = extractSegmentKey(url);
          if (segmentKey) {
            // Synchronously set up — the actual signing happens via a pre-fetched map
            // For HLS.js we need to modify the URL before the request
            // Use a synchronous approach: replace URL with our signing endpoint
            xhr.open('GET', url, true);
            return;
          }
        }
      },
    });

    // For segment signing, use the frag loading hook
    hls.on(Hls.Events.FRAG_LOADING, async (event, data) => {
      if (sess.segment_sign_url) {
        const fragUrl = data.frag.url;
        const segmentKey = extractSegmentKey(fragUrl);
        if (segmentKey) {
          try {
            const res = await fetch(sess.segment_sign_url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sess.session_token,
              },
              body: JSON.stringify({ segment_key: segmentKey }),
            });
            if (res.ok) {
              const json = await res.json();
              data.frag.url = json.data.signed_url;
            }
          } catch {
            // Fall through to original URL
          }
        }
      }
    });

    hlsInstance = hls;
    hls.loadSource(sess.master_playlist_url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // Set quality to highest
      if (qualities.length > 1) {
        hls.currentLevel = qualities.length - 1;
      }
      video.play().catch(() => {});
    });

    // Quality switching
    $videoQualitySelect.addEventListener('change', () => {
      hls.currentLevel = parseInt($videoQualitySelect.value, 10);
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        }
      }
    });
  } else {
    showError('Playback error', 'Your browser does not support video playback.');
    return;
  }

  // Set up controls
  setupVideoControls(sess, meta.video_metadata?.duration || 0);

  // Start watermark overlay
  videoWatermarkRaf = requestAnimationFrame(drawVideoWatermark);

  // Tracking (every 5 seconds)
  trackingInterval = setInterval(() => {
    trackVideoEvent(linkToken, sess.session_token);
  }, 5000);

  // Final track on unload
  window.addEventListener('beforeunload', () => {
    trackVideoEvent(linkToken, sess.session_token, true);
  });

  // Resize watermark canvas
  window.addEventListener('resize', () => {
    // Watermark will be redrawn on next animation frame
  });
}

function extractSegmentKey(url: string): string | null {
  // Extract the key portion: renders/{linkId}/video/{quality}/segment-NNN.ts
  const match = url.match(/(renders\/[^/]+\/video\/[^/]+\/segment-\d+\.ts)/);
  return match ? match[1] : null;
}

// ============================================
// START VIEWER (Document)
// ============================================

function startViewer(meta: LinkMetadata, sess: VerifyResponse) {
  session = sess;
  totalPages = sess.page_count || meta.page_count || sess.pages.length;
  currentPage = 1;
  pageTimes = {};
  pageStartTime = Date.now();
  totalDuration = 0;

  // Show viewer
  $docName.textContent = meta.name || 'Document';
  showScreen($viewer);

  // Seed the page field with the document length before the first render, so the viewer can
  // jump to a page without waiting for page 1's tiles.
  $pageCount.textContent = String(totalPages);
  syncPageInput(1, true);

  // Documents are streamed as tiles over a WebSocket instead of whole-page images.
  tileBitmaps.clear();
  tileHeaders.clear();
  pageGeometryCache.clear();
  readyPages.clear();
  requestedPages.clear();
  pageGeo = null;
  tileStream?.close();
  tileStream = new TileStream();

  tileStream.onPage = (geo) => {
    // The server sends a `page` message for EVERY viewport request, including the ones we
    // fire to preload a neighbouring page. Cache it either way — a preload's geometry is
    // exactly what makes the eventual navigation to that page instant. Only the page on
    // screen is painted: treating a preload's geometry as the current page's made
    // renderPage() believe it had no geometry for the page on screen, so it re-requested it
    // — which preloaded again — a ping-pong that burned the whole per-session request budget
    // in seconds and left the viewer stuck on a spinner.
    pageGeometryCache.set(geo.page, geo);
    if (geo.page !== currentPage) return;

    pageGeo = geo;
    renderPage(currentPage);
    // Warm the next page so forward navigation is instant.
    preloadAdjacentPages(currentPage);
  };

  tileStream.onTile = (header, bitmap) => {
    const key = `${header.page}:${header.col}-${header.row}`;
    if (tileBitmaps.has(key)) return; // already held
    tileBitmaps.set(key, bitmap);
    tileHeaders.set(key, header);
    if (header.page === currentPage) {
      drawTiles(header.page);
      updatePageLoading();
    }
  };

  tileStream.onDone = (page) => {
    // Only a COMPLETED page clears the back-off counter. Resetting it on every received
    // tile let the retry loop run forever: one success would re-arm the retry budget, so
    // the "give up after N" guard never fired and the client hammered the server.
    rateLimitRetries = 0;
    readyPages.add(page);
    requestedPages.delete(page);
    // The whole page is in hand — reveal it in one go and release the page controls.
    if (page === currentPage) {
      setNavigating(false);
      updatePageLoading(page);
    }
    // A landing page opens a new gap at the back of the prefetch window: continue the chain.
    preloadAdjacentPages(currentPage);
  };

  tileStream.onError = (code, message) => {
    console.error('[tiles]', code, message);
    // The error does not say which page failed, and the in-flight bookkeeping is only an
    // optimisation: dropping all of it is safe, and it lets the prefetch window try again instead
    // of treating a page that never arrived as permanently "on its way".
    const giveUp = () => {
      requestedPages.clear();
      setNavigating(false);
    };

    if (code === 'BAD_TILE' || code === 'DECRYPT_FAILED') {
      // A tile we cannot decode will not decode on retry either. Stop asking for the page
      // rather than looping.
      tileDecodeFailures += 1;
      if (tileDecodeFailures > 8) {
        console.warn('[tiles] too many undecodable tiles; not requesting further pages');
        giveUp(); // this page is not going to arrive — release the controls
        return;
      }
      lastRequestKey = '';
      return;
    }

    if (code === 'RATE_LIMITED') {
      // The budget refills every minute, so the current page is worth retrying — but slowly,
      // and never the preload, so the retry itself cannot keep the budget exhausted.
      // A tight loop here is what previously hammered the server.
      rateLimitRetries += 1;
      if (rateLimitRetries > 12) {
        console.warn('[tiles] still rate limited; giving up on this page');
        giveUp();
        return;
      }
      lastRequestKey = ''; // allow the retry through the de-duplication guard
      setTimeout(() => requestPageTiles(currentPage), 10_000);
      return;
    }

    // Anything else (bad request, crypto failure, dropped socket) is terminal for this page:
    // unlock the controls so the viewer is not stuck staring at a spinner.
    giveUp();
  };

  // The session key is only established after the handshake completes, so page content is
  // requested from onReady rather than immediately after connect.
  tileStream.onReady = () => {
    requestPageTiles(1);
  };

  tileStream.connect(linkToken, sess.session_token);

  // Nothing is on screen yet, so hold the page controls until the first page lands. Without
  // this, a click on Next during the initial load would race the page-1 request.
  setNavigating(true);
  // Show the overlay from the first frame. The handshake (RSA key generation plus a WebSocket
  // round trip) happens before the first tile request, and without this the viewer stares at an
  // empty canvas for that whole window — and the page looks ready when it is not.
  updatePageLoading(currentPage);

  setupNavigation();
  setupProtections();
  setupZoom();

  // Start tracking (5-second interval per spec)
  trackingInterval = setInterval(() => {
    trackEvent(linkToken, sess.session_token);
  }, 5000);

  // Final track on page unload
  window.addEventListener('beforeunload', () => {
    trackEvent(linkToken, sess.session_token, true);
  });

  // Re-render on resize
  window.addEventListener('resize', () => renderPage(currentPage));
}

// ============================================
// GATE FORM HANDLER
// ============================================

function setupGateForm() {
  $gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset errors
    $emailError.classList.add('hidden');
    $passwordError.classList.add('hidden');
    $gateError.classList.add('hidden');

    const email = metadata?.require_email ? $emailInput.value.trim() : undefined;
    const password = metadata?.has_password ? $passwordInput.value : undefined;

    // Validate email
    if (metadata?.require_email && !email) {
      $emailError.textContent = 'Email is required';
      $emailError.classList.remove('hidden');
      return;
    }

    // Validate email format
    if (email && !email.includes('@')) {
      $emailError.textContent = 'Please enter a valid email address';
      $emailError.classList.remove('hidden');
      return;
    }

    // Validate allowed domains
    if (metadata?.allowed_domains && email) {
      const domain = '@' + (email.split('@')[1] || '');
      if (!metadata.allowed_domains.includes(domain)) {
        $emailError.textContent = `Only ${metadata.allowed_domains.join(', ')} emails are allowed`;
        $emailError.classList.remove('hidden');
        return;
      }
    }

    $gateSubmit.disabled = true;
    $gateSubmit.textContent = 'Verifying...';

    const result = await verifyAccess(linkToken, email, password);

    if (!result.ok) {
      $gateSubmit.disabled = false;
      $gateSubmit.textContent = 'View Document';
      $gateError.textContent = result.message;
      $gateError.classList.remove('hidden');
      return;
    }

    if (metadata!.file_type === 'video') {
      startVideoViewer(metadata!, result.data);
    } else {
      startViewer(metadata!, result.data);
    }
  });

  // Group credentials are a different action, so they live in their own form.
  $credentialsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!metadata) return;

    $credentialsError.classList.add('hidden');

    const studentId = $studentIdInput.value.trim();
    const nationalId = $nationalIdInput.value.trim();
    if (!studentId || !nationalId) {
      $credentialsError.textContent = 'Student ID and national ID are required';
      $credentialsError.classList.remove('hidden');
      return;
    }

    $credentialsSubmit.disabled = true;
    $credentialsSubmit.textContent = 'Verifying...';

    const result = await verifyAccess(linkToken, undefined, undefined, {
      student_id: studentId,
      national_id: nationalId,
    });

    if (!result.ok) {
      $credentialsSubmit.disabled = false;
      $credentialsSubmit.textContent = 'Sign in';
      // Show the server's own message — it distinguishes a wrong credential from a paused,
      // expired or revoked link, which a generic message would hide.
      $credentialsError.textContent = result.message;
      $credentialsError.classList.remove('hidden');
      return;
    }

    if (metadata.file_type === 'video') {
      startVideoViewer(metadata, result.data);
    } else {
      startViewer(metadata, result.data);
    }
  });
}

// ============================================
// INIT
// ============================================

async function init() {
  linkToken = getToken() || '';

  if (!linkToken) {
    showError('Invalid link', 'This link is not valid.');
    return;
  }

  showScreen($loading);

  const meta = await fetchMetadata(linkToken);
  if (!meta) return; // Error already shown by fetchMetadata

  metadata = meta;

  // Hide "Secured by Scrinium" badge if paid plan
  if (meta.show_badge === false) {
    document.querySelectorAll('.secured-badge, .secured-by').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  }

  // Handle processing state — show SSE progress
  if (meta.status === 'processing') {
    const progressUrl = `${API_URL}/v1/links/${linkToken}/progress`;
    watchProgress(progressUrl);
    return;
  }

  // Show the gate when the link requires anything from the viewer. A group-restricted link
  // must be listed explicitly: its email/password flags are often both false, and without
  // this check the viewer would try to verify with no credentials at all and fail with
  // "Student ID and national ID are required".
  if (!meta.requires_credentials && !meta.require_email && !meta.has_password) {
    // No gate needed — verify immediately
    showScreen($loading);
    const result = await verifyAccess(linkToken);
    if (!result.ok) {
      showError('Access denied', result.message);
      return;
    }
    if (meta.file_type === 'video') {
      startVideoViewer(meta, result.data);
    } else {
      startViewer(meta, result.data);
    }
  } else {
    setupGate(meta);
    setupGateForm();
  }
}

// Boot — apply the theme first so the gate and the viewer paint in the right palette.
initTheme();
setupThemeToggle();
init();
