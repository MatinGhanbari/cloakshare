import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { links, views } from '../db/schema.js';
import { rateLimitByIp } from '../middleware/rateLimit.js';
import { successResponse } from '../lib/errors.js';
import type { Variables } from '../lib/types.js';

const publicRouter = new Hono<{ Variables: Variables }>();

/**
 * Aggregate counts for the landing page.
 *
 * Public on purpose: the landing is the first thing a visitor sees, and it should show the
 * deployment's real size rather than a hard-coded marketing number. Only three totals are
 * exposed and none of them is per-document, so nothing about an individual link leaks.
 */
publicRouter.get('/v1/public/stats', rateLimitByIp({ max: 60, window: 60 }), async (c) => {
  const [documentRow, viewRow, viewerRow] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(links).limit(1).then((r) => r[0]),
    db.select({ count: sql<number>`count(*)` }).from(views).limit(1).then((r) => r[0]),
    db
      .select({ count: sql<number>`count(distinct ${views.viewerEmail})` })
      .from(views)
      .limit(1)
      .then((r) => r[0]),
  ]);

  /* Postgres returns count() as bigint, which the driver hands back as a string. Number()
     keeps the JSON shape a number instead of "42". */
  return successResponse(c, {
    documents: Number(documentRow?.count ?? 0),
    views: Number(viewRow?.count ?? 0),
    viewers: Number(viewerRow?.count ?? 0),
  });
});

export default publicRouter;
