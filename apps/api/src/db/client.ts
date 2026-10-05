import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { mkdirSync, accessSync, constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import * as schema from './schema.js';

export function createDbClient() {
  if (config.database.provider === 'turso' && config.database.tursoUrl) {
    logger.info('Connecting to Turso database');
    const client = createClient({
      url: config.database.tursoUrl,
      authToken: config.database.tursoToken,
    });
    return drizzle(client, { schema });
  }

  // Local SQLite for development and self-hosted mode.
  const sqlitePath = config.database.sqlitePath;
  logger.info({ path: sqlitePath }, 'Using local SQLite database');

  // libsql does not create the parent directory, and its failure mode is an opaque
  // "Unable to open connection to local database ... : 14" (SQLITE_CANTOPEN). Create the
  // directory so the common case — a mounted disk whose subdirectory is missing, or a fresh
  // local checkout — just works.
  const dir = dirname(resolve(sqlitePath));
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new Error(
      `Cannot create the SQLite directory "${dir}": ${(err as Error).message}\n` +
        `Check that the volume is mounted and writable at that path.`,
    );
  }

  // A writable directory is a precondition libsql checks itself, but it only reports
  // "SQLITE_CANTOPEN (14)". Say what is actually wrong.
  try {
    accessSync(dir, fsConstants.W_OK);
  } catch {
    throw new Error(
      `The SQLite directory "${dir}" is not writable.\n` +
        `On Render, check that the Persistent Disk is mounted at that path and that the ` +
        `service user owns it.`,
    );
  }

  try {
    // libsql opens the database synchronously, so a missing path throws right here.
    const client = createClient({ url: `file:${sqlitePath}` });
    return drizzle(client, { schema });
  } catch (err) {
    throw new Error(
      `Cannot open the SQLite database at "${sqlitePath}": ${(err as Error).message}\n` +
        `On Render this almost always means no Persistent Disk is mounted at that path — ` +
        `the container filesystem is ephemeral, so SQLITE_PATH must point at a mounted volume ` +
        `(a disk mounted at /data with SQLITE_PATH=/data/cloak.db). ` +
        `Alternatively set DB_PROVIDER=turso to use hosted SQLite and skip the volume entirely.`,
    );
  }
}

export const db = createDbClient();

export type Database = typeof db;
