import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, bookingSchema } from '@courtly/contracts';
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

const OWN_BOOKING = '44444444-4444-4444-8444-444444444401';
const OTHER_BOOKING = '44444444-4444-4444-8444-444444444402';
const OWN_CANCELLED = '44444444-4444-4444-8444-444444444403';
const UNKNOWN_BOOKING = '44444444-4444-4444-8444-444444444499';

let pool: Pool;
let app: ReturnType<typeof createApp>;
let userToken: string;
let adminToken: string;

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

describe('booking detail API', () => {
  beforeAll(() => {
    pool = createTestPool();
    userToken = signAuthToken({ sub: USER_ID, role: 'USER' }, jwtSecret);
    adminToken = signAuthToken({ sub: ADMIN_ID, role: 'ADMIN' }, jwtSecret);
  });

  beforeEach(async () => {
    await pool.query('truncate table bookings, courts, users cascade');
    await seedDatabase(testDatabaseUrl);
    await pool.query('delete from bookings');
    app = createApp({ db: drizzle(pool), jwtSecret });

    await insertBooking({
      id: OWN_BOOKING,
      courtId: PADEL_1,
      userId: USER_ID,
      startAt: '2030-01-15T09:00:00Z',
      endAt: '2030-01-15T10:00:00Z',
      durationHours: 1,
      priceCents: 2_000,
      status: 'CONFIRMED',
    });
    await insertBooking({
      id: OTHER_BOOKING,
      courtId: PADEL_1,
      userId: OTHER_USER_ID,
      startAt: '2030-01-15T11:00:00Z',
      endAt: '2030-01-15T12:00:00Z',
      durationHours: 1,
      priceCents: 2_000,
      status: 'CONFIRMED',
    });
    await insertBooking({
      id: OWN_CANCELLED,
      courtId: PADEL_1,
      userId: USER_ID,
      startAt: '2030-01-14T09:00:00Z',
      endAt: '2030-01-14T11:00:00Z',
      durationHours: 2,
      priceCents: 4_000,
      status: 'CANCELLED',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /bookings/:id', () => {
    it('returns the booking to its owner', async () => {
      const response = await request(app)
        .get(`/bookings/${OWN_BOOKING}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(bookingSchema.parse(payload(response))).toMatchObject({
        id: OWN_BOOKING,
        courtId: PADEL_1,
        userId: USER_ID,
        startAt: '2030-01-15T09:00:00+00:00',
        endAt: '2030-01-15T10:00:00+00:00',
        durationHours: 1,
        priceCents: 2_000,
        status: 'CONFIRMED',
      });
    });

    it('returns a cancelled booking with status CANCELLED', async () => {
      const response = await request(app)
        .get(`/bookings/${OWN_CANCELLED}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(bookingSchema.parse(payload(response))).toMatchObject({
        id: OWN_CANCELLED,
        status: 'CANCELLED',
        durationHours: 2,
        priceCents: 4_000,
      });
    });

    it('returns 404 for another user’s booking, indistinguishable from an unknown id', async () => {
      const foreign = await request(app)
        .get(`/bookings/${OTHER_BOOKING}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
      const unknown = await request(app)
        .get(`/bookings/${UNKNOWN_BOOKING}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(apiErrorSchema.parse(foreign.body).error.code).toBe('NOT_FOUND');
      expect(foreign.body).toEqual(unknown.body);
    });

    it('does not special-case admins: an admin reading someone else’s booking gets 404', async () => {
      const response = await request(app)
        .get(`/bookings/${OTHER_BOOKING}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('NOT_FOUND');
    });

    it('returns 401 UNAUTHORIZED without a token', async () => {
      const response = await request(app).get(`/bookings/${OWN_BOOKING}`).expect(401);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a malformed id with 400 VALIDATION_FAILED', async () => {
      const response = await request(app)
        .get('/bookings/not-a-uuid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('still resolves GET /bookings/me to the list route', async () => {
      const response = await request(app)
        .get('/bookings/me')
        .query({ scope: 'upcoming' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const bookings = bookingSchema.array().parse(payload(response));

      expect(bookings.map((booking) => booking.id)).toEqual([OWN_BOOKING]);
    });
  });
});
