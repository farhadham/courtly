import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminBookingsResponseSchema, apiErrorSchema } from '@courtly/contracts';
import { createApp } from '../../src/app';
import { signAuthToken } from '../../src/auth/tokens';
import { seedDatabase } from '../../src/db/seed';
import { createTestPool, testDatabaseUrl } from '../db/test-database';
import { payload } from './payload';

const jwtSecret = 'test-secret';
const USER_ID = '11111111-1111-4111-8111-111111111101';
const OTHER_USER_ID = '11111111-1111-4111-8111-111111111102';
const ADMIN_ID = '11111111-1111-4111-8111-111111111103';
const PADEL_1 = '22222222-2222-4222-8222-222222222201';
const PADEL_2 = '22222222-2222-4222-8222-222222222202';
const TENNIS_1 = '22222222-2222-4222-8222-222222222203';

const DAY_A = '44444444-4444-4444-8444-444444444501';
const DAY_B = '44444444-4444-4444-8444-444444444502';
const PREVIOUS_DAY = '44444444-4444-4444-8444-444444444503';
const NEXT_DAY = '44444444-4444-4444-8444-444444444504';

let pool: Pool;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let userToken: string;

interface Fixture {
  id: string;
  courtId: string;
  userId: string;
  startAt: string;
  endAt: string;
  durationHours: 1 | 2;
  priceCents: number;
  status: 'CONFIRMED' | 'CANCELLED';
}

async function insertBooking(fixture: Fixture): Promise<void> {
  await pool.query(
    `insert into bookings
       (id, court_id, user_id, start_at, end_at, duration_hours, price_cents, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      fixture.id,
      fixture.courtId,
      fixture.userId,
      fixture.startAt,
      fixture.endAt,
      fixture.durationHours,
      fixture.priceCents,
      fixture.status,
    ],
  );
}

describe('admin bookings API', () => {
  beforeAll(() => {
    pool = createTestPool();
    adminToken = signAuthToken({ sub: ADMIN_ID, role: 'ADMIN' }, jwtSecret);
    userToken = signAuthToken({ sub: USER_ID, role: 'USER' }, jwtSecret);
  });

  beforeEach(async () => {
    await pool.query('truncate table bookings, courts, users cascade');
    await seedDatabase(testDatabaseUrl);
    await pool.query('delete from bookings');
    app = createApp({ db: drizzle(pool), jwtSecret });

    await insertBooking({
      id: DAY_A,
      courtId: PADEL_1,
      userId: USER_ID,
      startAt: '2030-01-15T09:00:00Z',
      endAt: '2030-01-15T10:00:00Z',
      durationHours: 1,
      priceCents: 2_000,
      status: 'CONFIRMED',
    });
    await insertBooking({
      id: DAY_B,
      courtId: TENNIS_1,
      userId: OTHER_USER_ID,
      startAt: '2030-01-15T18:00:00Z',
      endAt: '2030-01-15T19:00:00Z',
      durationHours: 1,
      priceCents: 3_000,
      status: 'CONFIRMED',
    });
    await insertBooking({
      id: PREVIOUS_DAY,
      courtId: PADEL_2,
      userId: USER_ID,
      startAt: '2030-01-14T09:00:00Z',
      endAt: '2030-01-14T10:00:00Z',
      durationHours: 1,
      priceCents: 2_500,
      status: 'CONFIRMED',
    });
    await insertBooking({
      id: NEXT_DAY,
      courtId: PADEL_1,
      userId: USER_ID,
      startAt: '2030-01-16T09:00:00Z',
      endAt: '2030-01-16T10:00:00Z',
      durationHours: 1,
      priceCents: 2_000,
      status: 'CONFIRMED',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /admin/bookings', () => {
    it('returns every booking starting that Lisbon day, flat, with day revenue', async () => {
      const response = await request(app)
        .get('/admin/bookings')
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = adminBookingsResponseSchema.parse(payload(response));

      expect(body.bookings.map((booking) => booking.id).sort()).toEqual([DAY_A, DAY_B]);
      expect(body.totalRevenueCents).toBe(5_000);
    });

    it('includes bookings from a deactivated court', async () => {
      await pool.query('update courts set is_active = false where id = $1', [PADEL_1]);

      const response = await request(app)
        .get('/admin/bookings')
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = adminBookingsResponseSchema.parse(payload(response));

      expect(body.bookings.map((booking) => booking.id)).toContain(DAY_A);
      expect(body.totalRevenueCents).toBe(5_000);
    });

    it('lists cancelled bookings but leaves them out of revenue', async () => {
      const CANCELLED = '44444444-4444-4444-8444-444444444505';

      await insertBooking({
        id: CANCELLED,
        courtId: PADEL_2,
        userId: OTHER_USER_ID,
        startAt: '2030-01-15T12:00:00Z',
        endAt: '2030-01-15T13:00:00Z',
        durationHours: 1,
        priceCents: 4_000,
        status: 'CANCELLED',
      });

      const response = await request(app)
        .get('/admin/bookings')
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = adminBookingsResponseSchema.parse(payload(response));

      expect(body.bookings.map((booking) => booking.id)).toContain(CANCELLED);
      expect(body.totalRevenueCents).toBe(5_000);
    });

    it('uses the snapshotted price after the court price changes', async () => {
      await pool.query('update courts set hourly_price_cents = 9999 where id = $1', [PADEL_1]);

      const response = await request(app)
        .get('/admin/bookings')
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminBookingsResponseSchema.parse(payload(response)).totalRevenueCents).toBe(5_000);
    });

    it('uses the Lisbon day, not the UTC day, in summer time', async () => {
      const LATE_PREVIOUS_LOCAL_DAY = '44444444-4444-4444-8444-444444444506';
      const EARLY_REQUESTED_LOCAL_DAY = '44444444-4444-4444-8444-444444444507';

      // 22:30Z is 23:30 in Lisbon on 10 July; 23:30Z is 00:30 in Lisbon on 11 July.
      await insertBooking({
        id: LATE_PREVIOUS_LOCAL_DAY,
        courtId: PADEL_1,
        userId: USER_ID,
        startAt: '2030-07-10T22:30:00Z',
        endAt: '2030-07-10T23:30:00Z',
        durationHours: 1,
        priceCents: 2_000,
        status: 'CONFIRMED',
      });
      await insertBooking({
        id: EARLY_REQUESTED_LOCAL_DAY,
        courtId: PADEL_2,
        userId: USER_ID,
        startAt: '2030-07-10T23:30:00Z',
        endAt: '2030-07-11T00:30:00Z',
        durationHours: 1,
        priceCents: 2_500,
        status: 'CONFIRMED',
      });

      const response = await request(app)
        .get('/admin/bookings')
        .query({ date: '2030-07-11' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = adminBookingsResponseSchema.parse(payload(response));

      expect(body.bookings.map((booking) => booking.id)).toEqual([EARLY_REQUESTED_LOCAL_DAY]);
      expect(body.totalRevenueCents).toBe(2_500);
    });

    it('returns an empty day with zero revenue', async () => {
      const response = await request(app)
        .get('/admin/bookings')
        .query({ date: '2030-02-01' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminBookingsResponseSchema.parse(payload(response))).toEqual({
        bookings: [],
        totalRevenueCents: 0,
      });
    });

    it('forbids a USER from reading the admin day view', async () => {
      const response = await request(app)
        .get('/admin/bookings')
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /admin/bookings validation', () => {
    it.each([
      ['a missing date', {}],
      ['a malformed date', { date: '15-01-2030' }],
      ['an impossible date', { date: '2030-02-30' }],
    ])('rejects %s with VALIDATION_FAILED', async (_label, query) => {
      const response = await request(app)
        .get('/admin/bookings')
        .query(query)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });
  });
});
