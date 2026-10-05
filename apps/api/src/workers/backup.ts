import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, unlink, rename, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);
const BACKUP_DIR = resolve(process.env.BACKUP_DIR || './data/backups');

let backupTimer: ReturnType<typeof setInterval> | null = null;

async function performBackup() {
  const connectionString = config.database.url;
  if (!connectionString) {
    logger.warn('BACKUP_ENABLED is true but DATABASE_URL is not set; skipping database backup.');
    return;
  }

  try {
    await mkdir(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(BACKUP_DIR, `cloak-${timestamp}.sql`);
    const tmpPath = `${backupPath}.tmp`;

    // Stream a logical dump straight to disk. In production we recommend relying on
    // your provider's managed backups (Supabase / RDS); this is a best-effort local copy.
    const child = execFile('pg_dump', [
      '--no-owner',
      '--if-exists',
      '--clean',
      connectionString,
    ], { maxBuffer: 64 * 1024 * 1024 });

    const writeStream = createWriteStream(tmpPath);
    child.stdout?.pipe(writeStream);

    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    const exitCode: number = await new Promise((resolveExit) => {
      child.on('close', (code) => resolveExit(code ?? 1));
    });
    await new Promise<void>((res) => writeStream.on('finish', () => res()));

    if (exitCode !== 0) {
      throw new Error(`pg_dump exited with code ${exitCode}: ${stderr}`);
    }

    await rename(tmpPath, backupPath);

    const backupStat = await stat(backupPath);
    logger.info(
      { backupPath, sizeBytes: backupStat.size },
      'Database backup created',
    );

    // Rotate old backups — keep only the most recent N
    await rotateBackups();
  } catch (error) {
    logger.error(
      { error },
      'Database backup failed. Ensure `pg_dump` (postgresql-client) is installed, ' +
      'or rely on your database provider\'s managed backups (Supabase / RDS).',
    );
  }
}

async function rotateBackups() {
  try {
    const files = await readdir(BACKUP_DIR);
    const backups = files
      .filter((f) => f.startsWith('cloak-') && f.endsWith('.sql'))
      .sort()
      .reverse(); // newest first

    const toDelete = backups.slice(config.backup.retainCount);
    for (const file of toDelete) {
      await unlink(join(BACKUP_DIR, file));
      logger.info({ file }, 'Rotated old backup');
    }
  } catch (error) {
    logger.error({ error }, 'Backup rotation failed');
  }
}

export function startBackupWorker() {
  if (!config.backup.enabled) {
    logger.debug('Database backup worker disabled');
    return;
  }

  const intervalMs = config.backup.intervalHours * 60 * 60 * 1000;

  // Run first backup after 2 minutes (let the server finish starting)
  setTimeout(performBackup, 2 * 60 * 1000);
  backupTimer = setInterval(performBackup, intervalMs);

  logger.info(
    { intervalHours: config.backup.intervalHours, retainCount: config.backup.retainCount },
    'Database backup worker started',
  );
}

export function stopBackupWorker() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  logger.info('Database backup worker stopped');
}
