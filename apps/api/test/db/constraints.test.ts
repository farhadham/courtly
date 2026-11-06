import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createTestPool } from './test-database';

const courtId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

let pool: Pool;

async function insertBooking(input: {
  startAt: string;
  endAt: string;
  durationHours?: number;
  status?: string;
}): Promise<void> {
  await pool.query(
    `insert into bookings (court_id, user_id, start_at, end_at, duration_hours, price_cents, status)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      courtId,
      userId,
      input.startAt,
      input.endAt,
      input.durationHours ?? 2,
      2_000,
      input.status ?? 'CONFIRMED',
    ],
  );
}

describe('bookings schema', () => {
  beforeAll(async () => {
    pool = createTestPool();
    await pool.query('select 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('truncate table bookings, courts, users cascade');
    await pool.query(
      `insert into users (id, email, password_hash, role)
       values ($1, 'user@courtly.test', 'hash', 'USER')`,
      [userId],
    );
    await pool.query(
      `insert into courts (id, name, sport_type, hourly_price_cents, opens_at, closes_at)
       values ($1, 'Padel 1', 'padel', 2000, '08:00', '23:00')`,
      [courtId],
    );
  });

  it('has the btree_gist extension installed', async () => {
    const result = await pool.query(`select 1 from pg_extension where extname = 'btree_gist'`);

    expect(result.rowCount).toBe(1);
  });

  it('exposes the exclusion constraint on bookings', async () => {
    const result = await pool.query<{ conname: string }>(
      `select conname from pg_constraint
       where conrelid = 'bookings'::regclass and contype = 'x'`,
    );

    expect(result.rows.map((row) => row.conname)).toEqual(['bookings_no_overlap']);
  });

  it('rejects an overlapping confirmed booking with 23P01', async () => {
    await insertBooking({
      startAt: '2026-11-07T08:00:00Z',
      endAt: '2026-11-07T10:00:00Z',
    });

    const error = await insertBooking({
      startAt: '2026-11-07T09:00:00Z',
      endAt: '2026-11-07T11:00:00Z',
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: '23P01' });
  });

  it('allows back-to-back bookings because bounds are half-open', async () => {
    await insertBooking({
      startAt: '2026-11-07T08:00:00Z',
      endAt: '2026-11-07T09:00:00Z',
      durationHours: 1,
    });
    await insertBooking({
      startAt: '2026-11-07T09:00:00Z',
      endAt: '2026-11-07T10:00:00Z',
      durationHours: 1,
    });

    const result = await pool.query('select count(*)::int as count from bookings');

    expect(result.rows[0]).toEqual({ count: 2 });
  });

  it('lets a cancelled booking share its slot', async () => {
    await insertBooking({
      startAt: '2026-11-07T08:00:00Z',
      endAt: '2026-11-07T10:00:00Z',
      status: 'CANCELLED',
    });
    await insertBooking({
      startAt: '2026-11-07T08:00:00Z',
      endAt: '2026-11-07T10:00:00Z',
    });

    const result = await pool.query('select count(*)::int as count from bookings');

    expect(result.rows[0]).toEqual({ count: 2 });
  });

  it('rejects a duration other than one or two hours', async () => {
    const error = await insertBooking({
      startAt: '2026-11-07T08:00:00Z',
      endAt: '2026-11-07T11:00:00Z',
      durationHours: 3,
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: '23514', constraint: 'bookings_duration_hours' });
  });

  it('rejects a status outside the booking status domain', async () => {
    const error = await insertBooking({
      startAt: '2026-11-07T08:00:00Z',
      endAt: '2026-11-07T09:00:00Z',
      durationHours: 1,
      status: 'cancelled',
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: '23514', constraint: 'bookings_status_valid' });
  });

  it('rejects an end time that is not after the start time', async () => {
    const error = await insertBooking({
      startAt: '2026-11-07T08:00:00Z',
      endAt: '2026-11-07T08:00:00Z',
      durationHours: 1,
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: '23514', constraint: 'bookings_end_after_start' });
  });
});
