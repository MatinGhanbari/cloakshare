import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { logger } from '../lib/logger.js';

async function runMigrations() {
  logger.info('Running database migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  logger.info('Migrations complete');
}

runMigrations()
  .catch((err) => {
    logger.error(err, 'Migration failed');
    process.exit(1);
  })
  .finally(() => {
    // Release the pool so the process can exit cleanly.
    void pool.end();
  });
