import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { seedDatabase } from '../../src/db/seed';
import { createTestPool, testDatabaseUrl } from './test-database';

let pool: Pool;

async function counts(): Promise<{ courts: number; users: number; bookings: number }> {
  const [courts, users, bookings] = await Promise.all([
    pool.query<{ count: number }>('select count(*)::int as count from courts'),
    pool.query<{ count: number }>('select count(*)::int as count from users'),
    pool.query<{ count: number }>('select count(*)::int as count from bookings'),
  ]);

  return {
    courts: courts.rows[0]?.count ?? -1,
    users: users.rows[0]?.count ?? -1,
    bookings: bookings.rows[0]?.count ?? -1,
  };
}

describe('seedDatabase', () => {
  beforeAll(async () => {
    pool = createTestPool();
    await pool.query('select 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('truncate table bookings, courts, users cascade');
  });

  it('creates 3 courts: two padel and one tennis', async () => {
    await seedDatabase(testDatabaseUrl);

    const result = await pool.query<{ sport_type: string; count: number }>(
      `select sport_type, count(*)::int as count
       from courts group by sport_type order by sport_type`,
    );

    expect(result.rows).toEqual([
      { sport_type: 'padel', count: 2 },
      { sport_type: 'tennis', count: 1 },
    ]);
  });

  it('creates two users and one admin', async () => {
    await seedDatabase(testDatabaseUrl);

    const result = await pool.query<{ role: string; count: number }>(
      `select role, count(*)::int as count
       from users group by role order by role`,
    );

    expect(result.rows).toEqual([
      { role: 'ADMIN', count: 1 },
      { role: 'USER', count: 2 },
    ]);
  });

  it('creates six bookings across past and future', async () => {
    await seedDatabase(testDatabaseUrl);

    const result = await pool.query<{ past: number; future: number }>(
      `select
         count(*) filter (where start_at < now())::int as past,
         count(*) filter (where start_at > now())::int as future
       from bookings`,
    );

    expect(result.rows[0]).toEqual({ past: 2, future: 4 });
  });

  it('does not duplicate rows when run twice', async () => {
    await seedDatabase(testDatabaseUrl);
    await seedDatabase(testDatabaseUrl);

    expect(await counts()).toEqual({ courts: 3, users: 3, bookings: 6 });
  });
});
