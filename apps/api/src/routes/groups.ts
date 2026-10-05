/**
 * Viewer groups and credentials — academic access control.
 *
 * An instructor creates a group (e.g. a course cohort), imports the authorized
 * viewers (student ID as username, national ID as password), and then restricts a
 * link to that group. Members of the group can open the link; everyone else cannot.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq, and, count, inArray } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../db/client.js';
import { viewerGroups, viewerCredentials, links } from '../db/schema.js';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { generateId } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { Variables } from '../lib/types.js';

const groupsRouter = new Hono<{ Variables: Variables }>();

/** bcrypt cost for national IDs. Lower than the account-password cost (12) because a
 *  bulk import hashes hundreds of rows in a single request; national IDs are also
 *  low-entropy, so this is a deliberate, documented tradeoff. */
const CREDENTIAL_COST = 10;

/** Upper bound per bulk import so one request cannot stall the worker. */
const MAX_BULK_CREDENTIALS = 200;

type Ctx = Context<any>;

/**
 * The scope that owns a group. `orgResolver` runs before `apiKeyAuth` (so `orgId` is
 * never populated here — the same reason routes/links.ts falls back to the user), so we
 * resolve the owner from the authenticated principal the same way links are scoped.
 */
function scopeId(c: Ctx): string | null {
  const apiKey = c.get('apiKey') as { orgId?: string | null } | undefined;
  const user = c.get('user') as { id?: string; defaultOrgId?: string | null } | undefined;
  return apiKey?.orgId || user?.defaultOrgId || user?.id || null;
}

/** The scope that owns this request's data. */
function requireOrg(c: Ctx): string | Response {
  const scope = scopeId(c);
  if (!scope) return errorResponse(c, Errors.forbidden('No organization in scope for this request'));
  return scope;
}

/** Confirm the group belongs to the caller's scope. */
async function ownedGroup(c: Ctx, groupId: string) {
  const scope = scopeId(c);
  if (!scope) return null;
  return (
    (await db
      .select()
      .from(viewerGroups)
      .where(and(eq(viewerGroups.id, groupId), eq(viewerGroups.orgId, scope)))
      .limit(1).then((r) => r[0])) ?? null
  );
}

const normaliseId = (value: unknown): string => String(value ?? '').trim();

// ============================================
// GROUPS
// ============================================

groupsRouter.get('/v1/groups', apiKeyAuth, async (c) => {
  const orgId = requireOrg(c);
  if (typeof orgId !== 'string') return orgId;

  const groups = await db
    .select()
    .from(viewerGroups)
    .where(eq(viewerGroups.orgId, orgId))
    ;

  const ids = groups.map((g) => g.id);
  const counts = ids.length
    ? await db
        .select({ groupId: viewerCredentials.groupId, total: count() })
        .from(viewerCredentials)
        .where(inArray(viewerCredentials.groupId, ids))
        .groupBy(viewerCredentials.groupId)
        
    : [];
  const countByGroup = new Map(counts.map((r) => [r.groupId, r.total]));

  // How many links currently point at each group.
  const linkRows = ids.length
    ? await db
        .select({ groupId: links.accessGroupId, total: count() })
        .from(links)
        .where(inArray(links.accessGroupId, ids))
        .groupBy(links.accessGroupId)
        
    : [];
  const linksByGroup = new Map(linkRows.map((r) => [r.groupId, r.total]));

  return successResponse(c, {
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      member_count: countByGroup.get(g.id) ?? 0,
      link_count: linksByGroup.get(g.id) ?? 0,
      created_at: g.createdAt,
    })),
  });
});

groupsRouter.post('/v1/groups', apiKeyAuth, async (c) => {
  const orgId = requireOrg(c);
  if (typeof orgId !== 'string') return orgId;

  const body = await c.req.json().catch(() => ({}));
  const name = normaliseId((body as { name?: string }).name);
  if (!name) return errorResponse(c, Errors.validation('name is required'));

  const id = generateId('grp');
  await db.insert(viewerGroups).values({ id, orgId, name });

  logger.info({ groupId: id, orgId }, 'Viewer group created');
  return successResponse(c, { id, name, member_count: 0, link_count: 0 }, 201);
});

groupsRouter.patch('/v1/groups/:id', apiKeyAuth, async (c) => {
  const group = await ownedGroup(c, c.req.param('id'));
  if (!group) return errorResponse(c, Errors.notFound('Group'));

  const body = await c.req.json().catch(() => ({}));
  const name = normaliseId((body as { name?: string }).name);
  if (!name) return errorResponse(c, Errors.validation('name is required'));

  await db.update(viewerGroups).set({ name }).where(eq(viewerGroups.id, group.id));
  return successResponse(c, { id: group.id, name });
});

groupsRouter.delete('/v1/groups/:id', apiKeyAuth, async (c) => {
  const group = await ownedGroup(c, c.req.param('id'));
  if (!group) return errorResponse(c, Errors.notFound('Group'));

  // Detach links first so they do not point at a deleted group.
  await db.update(links).set({ accessGroupId: null }).where(eq(links.accessGroupId, group.id));
  await db.delete(viewerCredentials).where(eq(viewerCredentials.groupId, group.id));
  await db.delete(viewerGroups).where(eq(viewerGroups.id, group.id));

  logger.info({ groupId: group.id }, 'Viewer group deleted');
  return successResponse(c, { id: group.id, deleted: true });
});

// ============================================
// CREDENTIALS
// ============================================

groupsRouter.get('/v1/groups/:id/credentials', apiKeyAuth, async (c) => {
  const group = await ownedGroup(c, c.req.param('id'));
  if (!group) return errorResponse(c, Errors.notFound('Group'));

  const rows = await db
    .select({
      id: viewerCredentials.id,
      studentId: viewerCredentials.studentId,
      displayName: viewerCredentials.displayName,
      createdAt: viewerCredentials.createdAt,
    })
    .from(viewerCredentials)
    .where(eq(viewerCredentials.groupId, group.id))
    ;

  return successResponse(c, {
    group: { id: group.id, name: group.name },
    // The national ID is never returned — only its hash is stored.
    credentials: rows.map((r) => ({
      id: r.id,
      student_id: r.studentId,
      name: r.displayName,
      created_at: r.createdAt,
    })),
  });
});

groupsRouter.post('/v1/groups/:id/credentials', apiKeyAuth, async (c) => {
  const group = await ownedGroup(c, c.req.param('id'));
  if (!group) return errorResponse(c, Errors.notFound('Group'));

  const body = (await c.req.json().catch(() => ({}))) as {
    student_id?: string;
    national_id?: string;
    name?: string;
  };
  const studentId = normaliseId(body.student_id);
  const nationalId = normaliseId(body.national_id);
  if (!studentId || !nationalId) {
    return errorResponse(c, Errors.validation('student_id and national_id are required'));
  }

  const existing = await db
    .select({ id: viewerCredentials.id })
    .from(viewerCredentials)
    .where(and(eq(viewerCredentials.groupId, group.id), eq(viewerCredentials.studentId, studentId)))
    .limit(1).then((r) => r[0]);
  if (existing) {
    return errorResponse(c, Errors.validation('This student ID is already in the group'));
  }

  const id = generateId('vcr');
  await db.insert(viewerCredentials).values({
    id,
    groupId: group.id,
    studentId,
    nationalIdHash: await bcrypt.hash(nationalId, CREDENTIAL_COST),
    displayName: body.name?.trim() || null,
  });

  return successResponse(c, { id, student_id: studentId, name: body.name?.trim() || null }, 201);
});

/**
 * Bulk import. Accepts either an array of objects or a raw text block
 * ("studentId,nationalId[,name]" per line) so a class list can be pasted directly.
 */
groupsRouter.post('/v1/groups/:id/credentials/bulk', apiKeyAuth, async (c) => {
  const group = await ownedGroup(c, c.req.param('id'));
  if (!group) return errorResponse(c, Errors.notFound('Group'));

  const body = (await c.req.json().catch(() => ({}))) as {
    credentials?: Array<{ student_id?: string; national_id?: string; name?: string }>;
    text?: string;
  };

  let incoming: Array<{ studentId: string; nationalId: string; name: string | null }> = [];

  if (Array.isArray(body.credentials)) {
    incoming = body.credentials.map((r) => ({
      studentId: normaliseId(r.student_id),
      nationalId: normaliseId(r.national_id),
      name: r.name?.trim() || null,
    }));
  } else if (typeof body.text === 'string') {
    incoming = body.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const [studentId, nationalId, ...rest] = line.split(/[,\t;]/).map((p) => p.trim());
        return {
          studentId: normaliseId(studentId),
          nationalId: normaliseId(nationalId),
          name: rest.join(' ').trim() || null,
        };
      });
  } else {
    return errorResponse(c, Errors.validation('Provide credentials[] or a text block'));
  }

  if (incoming.length === 0) {
    return errorResponse(c, Errors.validation('No credentials found in the request'));
  }
  if (incoming.length > MAX_BULK_CREDENTIALS) {
    return errorResponse(
      c,
      Errors.validation(`At most ${MAX_BULK_CREDENTIALS} credentials per import`),
    );
  }

  const existing = await db
    .select({ studentId: viewerCredentials.studentId })
    .from(viewerCredentials)
    .where(eq(viewerCredentials.groupId, group.id))
    ;
  const known = new Set(existing.map((r) => r.studentId));

  const added: string[] = [];
  const skipped: Array<{ student_id: string; reason: string }> = [];

  for (const row of incoming) {
    if (!row.studentId || !row.nationalId) {
      skipped.push({ student_id: row.studentId || '(blank)', reason: 'missing student_id or national_id' });
      continue;
    }
    if (known.has(row.studentId)) {
      skipped.push({ student_id: row.studentId, reason: 'already in group' });
      continue;
    }
    await db.insert(viewerCredentials).values({
      id: generateId('vcr'),
      groupId: group.id,
      studentId: row.studentId,
      nationalIdHash: await bcrypt.hash(row.nationalId, CREDENTIAL_COST),
      displayName: row.name,
    });
    known.add(row.studentId);
    added.push(row.studentId);
  }

  logger.info({ groupId: group.id, added: added.length, skipped: skipped.length }, 'Credentials imported');
  return successResponse(c, { added: added.length, skipped, group_id: group.id });
});

groupsRouter.delete('/v1/groups/:id/credentials/:credentialId', apiKeyAuth, async (c) => {
  const group = await ownedGroup(c, c.req.param('id'));
  if (!group) return errorResponse(c, Errors.notFound('Group'));

  const credential = await db
    .select({ id: viewerCredentials.id })
    .from(viewerCredentials)
    .where(
      and(
        eq(viewerCredentials.id, c.req.param('credentialId')),
        eq(viewerCredentials.groupId, group.id),
      ),
    )
    .limit(1).then((r) => r[0]);
  if (!credential) return errorResponse(c, Errors.notFound('Credential'));

  await db.delete(viewerCredentials).where(eq(viewerCredentials.id, credential.id));
  return successResponse(c, { id: credential.id, deleted: true });
});

export default groupsRouter;
