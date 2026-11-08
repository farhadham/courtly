import { existsSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';

const apiRoot = process.cwd();
const repoRoot = path.resolve(apiRoot, '../..');

const envFile = path.join(repoRoot, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://courtly:courtly@localhost:5432/courtly_test';

function assertTestDatabase(connectionString: string): void {
  const database = decodeURIComponent(new URL(connectionString).pathname.slice(1));

  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to run destructive tests against "${database}"; TEST_DATABASE_URL must name a *_test database.`,
    );
  }
}

export async function ensureTestDatabase(): Promise<void> {
  assertTestDatabase(testDatabaseUrl);

  const url = new URL(testDatabaseUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query('select 1 from pg_database where datname = $1', [database]);

    if (existing.rowCount === 0) {
      await client.query(`create database "${database.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
}

export async function migrateTestDatabase(): Promise<void> {
  assertTestDatabase(testDatabaseUrl);

  const pool = new Pool({ connectionString: testDatabaseUrl });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder: path.join(apiRoot, 'drizzle') });
  } finally {
    await pool.end();
  }
}

export function createTestPool(): Pool {
  assertTestDatabase(testDatabaseUrl);

  return new Pool({ connectionString: testDatabaseUrl });
}
