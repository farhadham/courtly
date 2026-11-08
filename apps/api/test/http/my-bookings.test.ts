import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingSchema, apiErrorSchema } from '@courtly/contracts';
import { createApp } from '../../src/app';
import { signAuthToken } from '../../src/auth/tokens';
import { seedDatabase } from '../../src/db/seed';
import { createTestPool, testDatabaseUrl } from '../db/test-database';
import { payload } from './payload';

const jwtSecret = 'test-secret';
const USER_ID = '11111111-1111-4111-8111-111111111101';
const OTHER_USER_ID = '11111111-1111-4111-8111-111111111102';
const PADEL_1 = '22222222-2222-4222-8222-222222222201';
const PADEL_2 = '22222222-2222-4222-8222-222222222202';
const TENNIS_1 = '22222222-2222-4222-8222-222222222203';

const OWN_UPCOMING = '44444444-4444-4444-8444-444444444401';
const OWN_PAST = '44444444-4444-4444-8444-444444444402';
const OTHER_UPCOMING = '44444444-4444-4444-8444-444444444403';
const OTHER_PAST = '44444444-4444-4444-8444-444444444404';

let pool: Pool;
let app: ReturnType<typeof createApp>;
let userToken: string;
let now: Date;

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

describe('my bookings API', () => {
  beforeAll(() => {
    pool = createTestPool();
    userToken = signAuthToken({ sub: USER_ID, role: 'USER' }, jwtSecret);
  });

  beforeEach(async () => {
    await pool.query('truncate table bookings, courts, users cascade');
    await seedDatabase(testDatabaseUrl);
    await pool.query('delete from bookings');
    now = new Date('2030-01-15T06:00:00Z');
    app = createApp({ db: drizzle(pool), jwtSecret, now: () => now });

    await insertBooking({
      id: OWN_UPCOMING,
      courtId: PADEL_1,
      userId: USER_ID,
      startAt: '2030-01-15T09:00:00Z',
      endAt: '2030-01-15T10:00:00Z',
      durationHours: 1,
      priceCents: 2_000,
      status: 'CONFIRMED',
    });
    await insertBooking({
      id: OWN_PAST,
      courtId: PADEL_1,
      userId: USER_ID,
      startAt: '2030-01-14T09:00:00Z',
      endAt: '2030-01-14T10:00:00Z',
      durationHours: 1,
      priceCents: 2_000,
      status: 'CONFIRMED',
    });
    await insertBooking({
      id: OTHER_UPCOMING,
      courtId: PADEL_2,
      userId: OTHER_USER_ID,
      startAt: '2030-01-15T09:00:00Z',
      endAt: '2030-01-15T10:00:00Z',
      durationHours: 1,
      priceCents: 2_500,
      status: 'CONFIRMED',
    });
    await insertBooking({
      id: OTHER_PAST,
      courtId: PADEL_2,
      userId: OTHER_USER_ID,
      startAt: '2030-01-14T09:00:00Z',
      endAt: '2030-01-14T10:00:00Z',
      durationHours: 1,
      priceCents: 2_500,
      status: 'CONFIRMED',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /bookings/me', () => {
    it('returns only the caller’s upcoming bookings', async () => {
      const response = await request(app)
        .get('/bookings/me')
        .query({ scope: 'upcoming' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const bookings = bookingSchema.array().parse(payload(response));

      expect(bookings.map((booking) => booking.id)).toEqual([OWN_UPCOMING]);
    });

    it('returns only the caller’s past bookings', async () => {
      const response = await request(app)
        .get('/bookings/me')
        .query({ scope: 'past' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const bookings = bookingSchema.array().parse(payload(response));

      expect(bookings.map((booking) => booking.id)).toEqual([OWN_PAST]);
    });

    it('splits exactly at now: a start equal to now is past, a second later is upcoming', async () => {
      const AT_NOW = '44444444-4444-4444-8444-444444444405';
      const JUST_BEFORE = '44444444-4444-4444-8444-444444444406';
      const JUST_AFTER = '44444444-4444-4444-8444-444444444407';

      await insertBooking({
        id: AT_NOW,
        courtId: PADEL_1,
        userId: USER_ID,
        startAt: '2030-01-15T06:00:00Z',
        endAt: '2030-01-15T07:00:00Z',
        durationHours: 1,
        priceCents: 2_000,
        status: 'CONFIRMED',
      });
      await insertBooking({
        id: JUST_BEFORE,
        courtId: PADEL_2,
        userId: USER_ID,
        startAt: '2030-01-15T05:59:59Z',
        endAt: '2030-01-15T06:59:59Z',
        durationHours: 1,
        priceCents: 2_500,
        status: 'CONFIRMED',
      });
      await insertBooking({
        id: JUST_AFTER,
        courtId: TENNIS_1,
        userId: USER_ID,
        startAt: '2030-01-15T06:00:01Z',
        endAt: '2030-01-15T07:00:01Z',
        durationHours: 1,
        priceCents: 2_000,
        status: 'CONFIRMED',
      });

      const upcoming = await request(app)
        .get('/bookings/me')
        .query({ scope: 'upcoming' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      const past = await request(app)
        .get('/bookings/me')
        .query({ scope: 'past' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const upcomingIds = bookingSchema
        .array()
        .parse(payload(upcoming))
        .map((booking) => booking.id);
      const pastIds = bookingSchema
        .array()
        .parse(payload(past))
        .map((booking) => booking.id);

      expect(upcomingIds).toContain(JUST_AFTER);
      expect(upcomingIds).not.toContain(AT_NOW);
      expect(pastIds).toContain(AT_NOW);
      expect(pastIds).toContain(JUST_BEFORE);
      expect(pastIds).not.toContain(JUST_AFTER);
    });

    it('keeps a cancelled booking in history and never in upcoming', async () => {
      const CANCELLED_UPCOMING = '44444444-4444-4444-8444-444444444408';

      await insertBooking({
        id: CANCELLED_UPCOMING,
        courtId: PADEL_1,
        userId: USER_ID,
        startAt: '2030-01-15T09:00:00Z',
        endAt: '2030-01-15T10:00:00Z',
        durationHours: 1,
        priceCents: 2_000,
        status: 'CANCELLED',
      });

      const upcoming = await request(app)
        .get('/bookings/me')
        .query({ scope: 'upcoming' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      const past = await request(app)
        .get('/bookings/me')
        .query({ scope: 'past' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const upcomingIds = bookingSchema
        .array()
        .parse(payload(upcoming))
        .map((booking) => booking.id);
      const pastIds = bookingSchema
        .array()
        .parse(payload(past))
        .map((booking) => booking.id);

      expect(upcomingIds).not.toContain(CANCELLED_UPCOMING);
      expect(pastIds).toContain(CANCELLED_UPCOMING);
    });
  });

  describe('GET /bookings/me validation', () => {
    it.each([
      ['missing scope', {}],
      ['an unknown scope', { scope: 'today' }],
    ])('rejects %s with VALIDATION_FAILED', async (_label, query) => {
      const response = await request(app)
        .get('/bookings/me')
        .query(query)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });
  });
});
