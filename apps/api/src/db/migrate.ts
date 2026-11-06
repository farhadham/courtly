import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './client';
import { databaseUrl } from './config';

export async function migrateDatabase(connectionString = databaseUrl()): Promise<void> {
  const { db, pool } = createDatabase(connectionString);

  try {
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}
