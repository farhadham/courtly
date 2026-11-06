import { ensureTestDatabase, migrateTestDatabase } from './test-database';

export default async function setup(): Promise<void> {
  await ensureTestDatabase();
  await migrateTestDatabase();
}
