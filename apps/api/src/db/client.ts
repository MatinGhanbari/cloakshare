import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import * as schema from './schema.js';

export function createDbClient() {
  const connectionString = config.database.url;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set.\n' +
      'Set it to a PostgreSQL connection string, for example:\n' +
      '  local Docker  : postgresql://postgres:<password>@localhost:5432/cloak\n' +
      '  Render/Supabase: postgresql://postgres:<password>@db.xxxx.supabase.co:5432/postgres\n',
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
