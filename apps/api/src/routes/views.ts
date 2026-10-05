import { Hono } from 'hono';
import { eq, and, sql, like } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../db/client.js';
import { links, views, viewerSessions, users, viewerGroups, viewerCredentials } from '../db/schema.js';
import { generateId, generateToken, sha256, getClientIp, parseUserAgent, formatDateForWatermark, renderWatermarkTemplate } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { rateLimitByIp } from '../middleware/rateLimit.js';
import { createStorage } from '../services/storage.js';
import { generateWatermarkedPages, getWatermarkedPageOnDemand } from '../services/watermarkRenderer.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { LINK_STATUS, PLAN_LIMITS } from '@cloak/shared';
import type { Plan } from '@cloak/shared';
import { dispatchWebhook } from '../services/webhooks.js';
import { reportUsage } from '../services/billing.js';
import { sendViewNotification } from '../services/email.js';
import { createNotification } from './notifications.js';
import type { Variables } from '../lib/types.js';

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

const viewsRouter = new Hono<{ Variables: Variables }>();

// ============================================
// GET /v1/time — Server time for client-side expiry mitigation
// ============================================

viewsRouter.get('/v1/time', (c) => {
  const now = new Date();
  return c.json({
    data: {
      timestamp: now.getTime(),
      iso: now.toISOString(),
    },
  });
});

// ============================================
// GET /v1/viewer/:token — Get link metadata for viewer
// ============================================

viewsRouter.get('/v1/viewer/:token', async (c) => {
  const linkId = c.req.param('token');

  const link = await db
    .select()
    .from(links)
    .where(eq(links.id, linkId))
    .limit(1).then((r) => r[0]);

  if (!link) {
    return errorResponse(c, Errors.notFound('Link'));
  }

  // Temporarily paused by the owner — checked before anything else so a disabled link
  // reveals nothing about the document.
  if (link.disabledAt) {
    return errorResponse(c, Errors.linkDisabled());
  }

  // Check link status
  if (link.status === LINK_STATUS.PROCESSING) {
    return successResponse(c, {
      status: 'processing',
      message: 'This document is being prepared. Please try again in a moment.',
      progress_url: `${config.apiUrl}/v1/links/${linkId}/progress`,
    }, 202);
  }

  if (link.status === LINK_STATUS.FAILED) {
    return errorResponse(c, Errors.linkFailed());
  }

  if (link.status === LINK_STATUS.REVOKED) {
    return errorResponse(c, Errors.linkRevoked());
  }

  if (link.status === LINK_STATUS.EXPIRED) {
    return errorResponse(c, Errors.linkExpired());
  }

  // Check expiry
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    await db.update(links).set({ status: 'expired' }).where(eq(links.id, linkId));
    return errorResponse(c, Errors.linkExpired());
  }

  // Check max views
  if (link.maxViews && link.viewCount >= link.maxViews) {
    await db.update(links).set({ status: 'expired' }).where(eq(links.id, linkId));
    return errorResponse(c, Errors.linkExpired());
  }

  // Determine badge visibility based on link owner's plan
  const linkOwner = await db.select({ plan: users.plan }).from(users).where(eq(users.id, link.userId)).limit(1).then((r) => r[0]);
  const showBadge = !linkOwner || linkOwner.plan === 'free';

  // Restricted links: the viewer signs in with a group credential instead of an email.
  let accessGroupName: string | null = null;
  if (link.accessGroupId) {
    const group = await db
      .select({ name: viewerGroups.name })
      .from(viewerGroups)
      .where(eq(viewerGroups.id, link.accessGroupId))
      .limit(1).then((r) => r[0]);
    accessGroupName = group?.name ?? null;
  }

  return successResponse(c, {
    status: link.status,
    file_type: link.fileType,
    require_email: link.requireEmail,
    requires_credentials: !!link.accessGroupId,
    access_group_name: accessGroupName,
    has_password: !!link.passwordHash,
    allowed_domains: safeJsonParse(link.allowedDomains, null),
    page_count: link.pageCount,
    video_metadata: link.fileType === 'video' ? {
      duration: link.videoDuration,
      width: link.videoWidth,
      height: link.videoHeight,
      qualities: safeJsonParse(link.videoQualities, []),
    } : undefined,
    brand_name: link.brandName,
    brand_color: link.brandColor,
    brand_logo_url: link.brandLogo,
    watermark_enabled: link.watermarkEnabled,
    show_badge: showBadge,
    view_count: link.viewCount,
    name: link.name,
  });
});

// ============================================
// POST /v1/viewer/:token/verify — Verify email & password
// ============================================

viewsRouter.post(
  '/v1/viewer/:token/verify',
  rateLimitByIp({
    max: 5,
    window: 15 * 60, // 15 minutes
    keyFn: (c) => `verify:${c.req.param('token')}:${getClientIp(c.req.raw.headers)}`,
  }),
  async (c) => {
    const linkId = c.req.param('token');
    const { email, password, student_id, national_id } = await c.req.json();

    const link = await db
      .select()
      .from(links)
      .where(eq(links.id, linkId))
      .limit(1).then((r) => r[0]);

    if (!link || link.status !== LINK_STATUS.ACTIVE) {
      return errorResponse(c, Errors.notFound('Link'));
    }

    // Temporarily paused by the owner.
    if (link.disabledAt) {
      return errorResponse(c, Errors.linkDisabled());
    }

    // Check expiry
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      await db.update(links).set({ status: 'expired' }).where(eq(links.id, linkId));
      return errorResponse(c, Errors.linkExpired());
    }

    // Check max views (per-link limit)
    if (link.maxViews && link.viewCount >= link.maxViews) {
      await db.update(links).set({ status: 'expired' }).where(eq(links.id, linkId));
      return errorResponse(c, Errors.linkExpired());
    }

    // Check monthly view limit for link owner's plan
    const linkOwner = await db.select({ plan: users.plan }).from(users).where(eq(users.id, link.userId)).limit(1).then((r) => r[0]);
    if (linkOwner) {
      const ownerPlan = linkOwner.plan as Plan;
      const planLimits = PLAN_LIMITS[ownerPlan];
      if (planLimits) {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const monthlyViews = await db.select({ count: sql<number>`count(*)` }).from(views)
          .where(and(
            eq(views.linkId, linkId),
            like(views.createdAt, `${currentMonth}%`),
          )).limit(1).then((r) => r[0]);
        if ((monthlyViews?.count ?? 0) >= planLimits.viewsPerMonth) {
          return errorResponse(c, Errors.limitReached('This document has reached its monthly view limit.'));
        }
      }
    }

    // Restricted link: the viewer signs in with a group credential — student ID as the
    // username, national ID as the password — instead of an email address.
    let credentialIdentity: string | null = null;
    if (link.accessGroupId) {
      const studentId = String(student_id ?? '').trim();
      const nationalId = String(national_id ?? '').trim();
      if (!studentId || !nationalId) {
        return errorResponse(c, Errors.validation('Student ID and national ID are required'));
      }

      const credential = await db
        .select()
        .from(viewerCredentials)
        .where(
          and(
            eq(viewerCredentials.groupId, link.accessGroupId),
            eq(viewerCredentials.studentId, studentId),
          ),
        )
        .limit(1).then((r) => r[0]);

      // Identical response for "unknown student ID" and "wrong national ID" so the
      // endpoint cannot be used to enumerate which student IDs are authorized.
      if (!credential || !(await bcrypt.compare(nationalId, credential.nationalIdHash))) {
        logger.warn({ linkId, studentId }, 'Rejected viewer credential');
        return errorResponse(c, Errors.unauthorized('Student ID or national ID is incorrect'));
      }
      credentialIdentity = credential.studentId;
    } else if (!email) {
      // Email is MANDATORY for public links. The per-viewer watermark is burned into the
      // page pixels and is the only protection that survives a screenshot, so an
      // anonymous viewer would leave no attribution trail.
      return errorResponse(c, Errors.validation('Email is required'));
    }

    // The identity that gets burned into the watermark and recorded against the view.
    const viewerIdentity: string | null = credentialIdentity ?? email ?? null;

    // Verify allowed domains
    if (link.allowedDomains && email) {
      const domains = safeJsonParse<string[]>(link.allowedDomains, []);
      const emailDomain = '@' + email.split('@')[1];
      if (!domains.includes(emailDomain)) {
        return errorResponse(c, Errors.domainNotAllowed(domains));
      }
    }

    // Verify password
    if (link.passwordHash) {
      if (!password) {
        return errorResponse(c, Errors.validation('Password is required'));
      }
      const valid = await bcrypt.compare(password, link.passwordHash);
      if (!valid) {
        return errorResponse(c, Errors.invalidPassword());
      }
    }

    // Create viewer session
    const sessionToken = generateToken(16);
    const sessionShortId = sessionToken.slice(0, 6);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    // Hash viewer session token before storage
    const sessionTokenHash = sha256(sessionToken);

    await db.insert(viewerSessions).values({
      id: generateId('vs'),
      linkId,
      viewerEmail: viewerIdentity || 'anonymous',
      token: sessionTokenHash,
      expiresAt,
      ipAddress: getClientIp(c.req.raw.headers),
    });

    // Create view record
    const ua = c.req.header('user-agent') || null;
    const { device, browser, os } = parseUserAgent(ua);

    const viewId = generateId('view');
    await db.insert(views).values({
      id: viewId,
      linkId,
      viewerEmail: viewerIdentity ?? null,
      viewerIp: getClientIp(c.req.raw.headers),
      viewerUserAgent: ua,
      viewerCountry: c.req.header('cf-ipcountry') || null,
      viewerCity: c.req.header('cf-ipcity') || null,
      viewerDevice: device,
      viewerBrowser: browser,
      viewerOs: os,
      sessionToken: sessionTokenHash,
    });

    // Atomic view count increment
    await db.update(links)
      .set({ viewCount: sql`${links.viewCount} + 1` })
      .where(eq(links.id, linkId));

    // Build watermark text
    const watermarkText = link.watermarkEnabled
      ? renderWatermarkTemplate(
          link.watermarkTemplate || '{{email}} · {{date}} · {{session_id}}',
          {
            email: viewerIdentity || 'anonymous',
            date: formatDateForWatermark(),
            session_id: sessionShortId,
          },
        )
      : '';

    logger.info({
      linkId,
      viewerEmail: viewerIdentity,
      viewId,
      device,
    }, 'View session started');

    // Fire webhook: link.viewed (async, non-blocking)
    dispatchWebhook(linkId, 'link.viewed', {
      viewer_email: viewerIdentity || 'anonymous',
      view_id: viewId,
      device,
      country: c.req.header('cf-ipcountry') || null,
    }).catch((err) => logger.warn({ err, linkId }, 'Webhook dispatch failed'));

    // Create in-app notification for link owner (async, non-blocking)
    createNotification({
      userId: link.userId,
      orgId: link.orgId || undefined,
      type: 'link.viewed',
      linkId,
      linkName: link.name || link.originalFilename || link.id,
      message: `${email || 'Anonymous'} viewed "${link.name || link.originalFilename || 'your link'}"`,
      metadata: {
        viewer_email: viewerIdentity || 'anonymous',
        view_id: viewId,
        device,
        country: c.req.header('cf-ipcountry') || null,
      },
    }).catch((err) => logger.warn({ err, linkId }, 'Notification creation failed'));

    // Report usage for billing (async, non-blocking)
    reportUsage(link.userId, 'view_recorded').catch((err) => logger.warn({ err }, 'Usage reporting failed'));

    // Send email notification to link owner if configured (async, non-blocking)
    if (link.notifyEmail || config.features.emailNotifications) {
      const owner = await db.select({ email: users.email }).from(users)
        .where(eq(users.id, link.userId)).limit(1).then((r) => r[0]);
      if (owner && (link.notifyEmail || owner.email)) {
        sendViewNotification({
          ownerEmail: link.notifyEmail || owner.email,
          linkName: link.name || link.originalFilename || link.id,
          linkId,
          viewerEmail: viewerIdentity || 'anonymous',
          viewerDevice: device,
          viewerCountry: c.req.header('cf-ipcountry') || null,
        }).catch((err) => logger.warn({ err }, 'View notification email failed'));
      }
    }

    const storage = createStorage();

    // Video links: return HLS playlist URLs instead of page URLs
    if (link.fileType === 'video') {
      const { generateSessionManifest } = await import('../services/transcoder.js');

      // Generate per-session manifest with pre-signed URLs baked in (for Safari/iOS)
      const qualities = safeJsonParse<string[]>(link.videoQualities, []);
      const sessionManifestContent = await generateSessionManifest(linkId, qualities);

      // Also provide the static master playlist URL for HLS.js (which re-signs per segment)
      const masterKey = `renders/${linkId}/video/master.m3u8`;
      const masterPlaylistUrl = await storage.getSignedUrl(masterKey, 300);

      return successResponse(c, {
        session_token: sessionToken,
        viewer_email: viewerIdentity || 'anonymous',
        file_type: 'video',
        master_playlist_url: masterPlaylistUrl,
        session_manifest: sessionManifestContent,
        segment_sign_url: `${config.apiUrl}/v1/viewer/${linkId}/sign-segment`,
        watermark_text: watermarkText,
        video_metadata: {
          duration: link.videoDuration,
          width: link.videoWidth,
          height: link.videoHeight,
          qualities,
        },
      });
    }

    // Document links: generate page URLs
    const pageCount = link.pageCount || 0;
    const pages: { page: number; url: string }[] = [];

    if (link.watermarkEnabled && pageCount > 0) {
      // Server-side watermarks: generate watermarked images for this session
      try {
        const sessionVsId = (await db
          .select({ id: viewerSessions.id })
          .from(viewerSessions)
          .where(eq(viewerSessions.token, sessionTokenHash))
          .limit(1).then((r) => r[0]))!.id;

        const watermarkedUrls = await generateWatermarkedPages(
          linkId,
          sessionVsId,
          watermarkText,
          pageCount,
        );

        for (let i = 0; i < watermarkedUrls.length; i++) {
          pages.push({ page: i + 1, url: watermarkedUrls[i] });
        }
      } catch (err) {
        // FAIL CLOSED. Falling back to clean pages would silently strip the per-viewer
        // watermark — i.e. the security control would disable itself exactly when it is
        // needed. Refuse to serve instead.
        logger.error({ err, linkId }, 'Watermark rendering failed — refusing to serve unwatermarked pages');
        return errorResponse(
          c,
          Errors.internal('This document could not be prepared securely. Please try again in a moment.'),
        );
      }
    } else if (!link.watermarkEnabled) {
      // Serving the clean pages would mean no attribution at all, so this is refused
      // rather than silently downgraded.
      logger.error({ linkId }, 'Refusing to serve a link with watermarking disabled');
      return errorResponse(
        c,
        Errors.forbidden('This document is not configured for secure viewing. Contact the sender.'),
      );
    } else {
      // Watermarking is enabled but no pages are rendered yet — the document is still
      // processing. Tell the client to retry instead of serving anything unwatermarked.
      return errorResponse(c, Errors.linkProcessing());
    }

    return successResponse(c, {
      session_token: sessionToken,
      viewer_email: viewerIdentity || 'anonymous',
      pages,
      page_count: pageCount,
      watermark_text: watermarkText,
    });
  },
);

// ============================================
// POST /v1/viewer/:token/sign-segment — Sign an HLS segment URL
// ============================================

viewsRouter.post('/v1/viewer/:token/sign-segment', async (c) => {
  const linkId = c.req.param('token');
  const sessionToken = c.req.header('x-session-token');

  if (!sessionToken) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Session required' } }, 401);
  }

  // Validate session — hash token before lookup
  const session = await db
    .select()
    .from(viewerSessions)
    .where(eq(viewerSessions.token, sha256(sessionToken)))
    .limit(1).then((r) => r[0]);

  if (!session || new Date(session.expiresAt) < new Date()) {
    return errorResponse(c, Errors.unauthorized('Session expired'));
  }

  if (session.linkId !== linkId) {
    return errorResponse(c, Errors.forbidden('Session mismatch'));
  }

  const { segment_key } = await c.req.json();
  if (!segment_key || !segment_key.startsWith(`renders/${linkId}/video/`)) {
    return errorResponse(c, Errors.validation('Invalid segment key'));
  }

  const storage = createStorage();
  const url = await storage.getSignedUrl(segment_key, 60); // 60 sec expiry

  return c.json({ data: { url } });
});

// ============================================
// GET /v1/viewer/:token/page/:pageNumber — On-demand watermarked page
// ============================================

viewsRouter.get('/v1/viewer/:token/page/:pageNumber', async (c) => {
  const linkId = c.req.param('token');
  const pageNumberStr = c.req.param('pageNumber');
  const sessionToken = c.req.header('x-session-token');

  if (!sessionToken) {
    return errorResponse(c, Errors.unauthorized('Session token required'));
  }

  // Validate session — hash token before lookup
  const session = await db
    .select()
    .from(viewerSessions)
    .where(eq(viewerSessions.token, sha256(sessionToken)))
    .limit(1).then((r) => r[0]);

  if (!session || new Date(session.expiresAt) < new Date()) {
    return errorResponse(c, Errors.unauthorized('Session expired. Please re-verify.'));
  }

  if (session.linkId !== linkId) {
    return errorResponse(c, Errors.forbidden('Session mismatch'));
  }

  const link = await db.select().from(links).where(eq(links.id, linkId)).limit(1).then((r) => r[0]);
  if (!link) return errorResponse(c, Errors.notFound('Link'));

  // Temporarily paused by the owner.
  if (link.disabledAt) {
    return errorResponse(c, Errors.linkDisabled());
  }

  const page = parseInt(pageNumberStr, 10);
  if (isNaN(page) || page < 1 || page > (link.pageCount || 0)) {
    return errorResponse(c, Errors.validation(`Page must be between 1 and ${link.pageCount}`));
  }

  // Build watermark text for this session
  const watermarkText = link.watermarkEnabled
    ? renderWatermarkTemplate(
        link.watermarkTemplate || '{{email}} · {{date}} · {{session_id}}',
        {
          email: session.viewerEmail,
          date: formatDateForWatermark(),
          session_id: sessionToken.slice(0, 6),
        },
      )
    : '';

  if (!link.watermarkEnabled || !watermarkText) {
    // FAIL CLOSED — never hand out a clean page URL; that would remove all attribution.
    logger.error({ linkId, page }, 'Refusing to serve an unwatermarked page');
    return errorResponse(
      c,
      Errors.forbidden('This document is not configured for secure viewing. Contact the sender.'),
    );
  }

  const signedUrl = await getWatermarkedPageOnDemand(
    linkId,
    session.id,
    watermarkText,
    page,
  );

  return successResponse(c, { url: signedUrl, page });
});

// ============================================
// POST /v1/viewer/:token/track — Track view events
// ============================================

viewsRouter.post('/v1/viewer/:token/track', async (c) => {
  const sessionToken = c.req.header('x-session-token');
  if (!sessionToken) {
    return c.body(null, 204);
  }

  const body = await c.req.json();
  const {
    current_page, seconds_on_page, total_duration, page_times, is_final,
    // Video tracking fields
    video_watch_time, video_current_time, video_total_duration,
  } = body;

  // Find the view record by session token (stored hashed)
  const view = await db
    .select()
    .from(views)
    .where(eq(views.sessionToken, sha256(sessionToken)))
    .limit(1).then((r) => r[0]);

  if (!view) {
    return c.body(null, 204);
  }

  // Video tracking
  if (video_watch_time != null || video_current_time != null) {
    const videoCompletionRate = video_total_duration > 0
      ? parseFloat(Math.min(video_current_time / video_total_duration, 1.0).toFixed(2))
      : 0;

    await db.update(views)
      .set({
        duration: total_duration || video_watch_time || 0,
        videoWatchTime: video_watch_time || 0,
        videoMaxReached: video_current_time || 0,
        completionRate: videoCompletionRate,
        endedAt: is_final ? new Date().toISOString() : null,
      })
      .where(eq(views.id, view.id));

    return c.body(null, 204);
  }

  // Document tracking
  const pagesViewed = page_times
    ? Object.keys(page_times).length
    : (current_page || 1);

  const link = await db
    .select({ pageCount: links.pageCount })
    .from(links)
    .where(eq(links.id, view.linkId))
    .limit(1).then((r) => r[0]);

  const pageCount = link?.pageCount || 1;
  const completionRate = parseFloat((pagesViewed / pageCount).toFixed(2));

  await db.update(views)
    .set({
      duration: total_duration || 0,
      pagesViewed,
      pageDetails: page_times ? JSON.stringify(
        Object.entries(page_times).map(([page, seconds]) => ({
          page: parseInt(page),
          seconds: Math.round(seconds as number),
        })),
      ) : null,
      completionRate,
      endedAt: is_final ? new Date().toISOString() : null,
    })
    .where(eq(views.id, view.id));

  return c.body(null, 204);
});

export default viewsRouter;
