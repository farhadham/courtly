import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export interface Database {
  db: ReturnType<typeof drizzle>;
  pool: Pool;
}

export type AppDatabase = Database['db'];

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({ connectionString });

  return { db: drizzle(pool), pool };
}
