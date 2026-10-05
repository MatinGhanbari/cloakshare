import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { setDefaultResultOrder } from 'node:dns';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import * as schema from './schema.js';

// Supabase's direct database host (db.<project-ref>.supabase.co) is IPv6-only, and platforms
// such as Render have no IPv6 egress — connecting then fails with ENETUNREACH. Node >=17 returns
// DNS results in verbatim order (often AAAA first), so prefer IPv4 whenever a host offers it.
// For IPv6-only hosts you must use the Supabase IPv4 connection pooler instead (see below).
setDefaultResultOrder('ipv4first');

export function createDbClient() {
  const connectionString = config.database.url;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set.\n' +
      'Set it to a PostgreSQL connection string, for example:\n' +
      '  local Docker  : postgresql://postgres:<password>@localhost:5432/cloak\n' +
      '  Render/Supabase: postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n',
    );
  }

  logger.info('Connecting to PostgreSQL database');
  const pool = new Pool({ connectionString });

  // Surface unexpected pool errors instead of failing silently on the next query.
  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected PostgreSQL pool error');
  });

  return { db: drizzle(pool, { schema }), pool };
}

const { db, pool } = createDbClient();

export { db, pool };
export type Database = typeof db;

// Gracefully release the connection pool (used on server shutdown).
export async function closeDb(): Promise<void> {
  await pool.end();
}

/**
 * Turn a low-level socket/DNS failure into an actionable message.
 * The most common case on Render is ENETUNREACH to a Supabase IPv6 address.
 */
export function explainDbConnectError(err: unknown): string {
  const e = err as NodeJS.ErrnoException & { address?: string };
  const code = e?.code;
  const addr = typeof e?.address === 'string' ? e.address : '';
  const isIpv6 = addr.includes(':');

  if ((code === 'ENETUNREACH' || code === 'EHOSTUNREACH' || code === 'ENETDOWN') && isIpv6) {
    return (
      `Could not reach the database at IPv6 address ${addr}: this network has no IPv6 egress ` +
      `(common on Render/Heroku). Supabase's direct host (db.<project-ref>.supabase.co) is IPv6-only, ` +
      `so use the IPv4 connection pooler instead:\n` +
      `  postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n` +
      `Copy the exact string from Supabase -> Project Settings -> Database -> Connection pooling ` +
      `(note the "postgres.<project-ref>" username).`
    );
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Could not resolve the database host. Check DATABASE_URL (host and region). (${e.message})`;
  }

  return e?.message ?? String(err);
}
