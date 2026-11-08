import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, availabilityResponseSchema, bookingSchema } from '@courtly/contracts';
import type { Booking } from '@courtly/contracts';
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

let pool: Pool;
let app: ReturnType<typeof createApp>;
let userToken: string;
let otherUserToken: string;
let adminToken: string;
let now: Date;

describe('bookings API', () => {
  beforeAll(() => {
    pool = createTestPool();
    userToken = signAuthToken({ sub: USER_ID, role: 'USER' }, jwtSecret);
    otherUserToken = signAuthToken({ sub: OTHER_USER_ID, role: 'USER' }, jwtSecret);
    adminToken = signAuthToken({ sub: ADMIN_ID, role: 'ADMIN' }, jwtSecret);
  });

  beforeEach(async () => {
    await pool.query('truncate table bookings, courts, users cascade');
    await seedDatabase(testDatabaseUrl);
    await pool.query('delete from bookings');
    now = new Date('2030-01-15T06:00:00Z');
    app = createApp({ db: drizzle(pool), jwtSecret, now: () => now });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /bookings', () => {
    it('creates a booking for the authenticated user', async () => {
      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: PADEL_1,
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 1,
        })
        .expect(201);

      expect(bookingSchema.parse(payload(response))).toMatchObject({
        courtId: PADEL_1,
        userId: USER_ID,
        startAt: '2030-01-15T09:00:00+00:00',
        endAt: '2030-01-15T10:00:00+00:00',
        durationHours: 1,
        priceCents: 2_000,
        status: 'CONFIRMED',
      });
    });
  });

  describe('POST /bookings overlap', () => {
    it('rejects an overlapping booking with SLOT_TAKEN', async () => {
      const body = {
        courtId: PADEL_1,
        startAt: '2030-01-15T09:00:00+00:00',
        durationHours: 1,
      };

      await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(body)
        .expect(201);

      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(body)
        .expect(409);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('SLOT_TAKEN');
    });

    it('accepts a back-to-back booking', async () => {
      await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: PADEL_1,
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 1,
        })
        .expect(201);

      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: PADEL_1,
          startAt: '2030-01-15T10:00:00+00:00',
          durationHours: 1,
        })
        .expect(201);

      expect(bookingSchema.parse(payload(response))).toMatchObject({
        startAt: '2030-01-15T10:00:00+00:00',
        endAt: '2030-01-15T11:00:00+00:00',
      });
    });

    it('gives one of two simultaneous requests the slot and the other SLOT_TAKEN', async () => {
      const body = {
        courtId: PADEL_1,
        startAt: '2030-01-15T09:00:00+00:00',
        durationHours: 1,
      };
      const attempt = () =>
        request(app).post('/bookings').set('Authorization', `Bearer ${userToken}`).send(body);

      const responses = await Promise.all([attempt(), attempt()]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      expect(
        apiErrorSchema.parse(responses.find((response) => response.status === 409)?.body).error
          .code,
      ).toBe('SLOT_TAKEN');

      const result = await pool.query<{ count: number }>(
        `select count(*)::int as count from bookings where start_at = '2030-01-15T09:00:00Z'`,
      );
      expect(result.rows[0]).toEqual({ count: 1 });
    });
  });

  describe('POST /bookings rejections', () => {
    it.each([
      [
        'a start at the current instant',
        { startAt: '2030-01-15T06:00:00+00:00' },
        422,
        'BOOKING_IN_PAST',
      ],
      [
        'a start before opening',
        { startAt: '2030-01-15T07:00:00+00:00' },
        422,
        'OUTSIDE_OPENING_HOURS',
      ],
      [
        'a start off the hour grid',
        { startAt: '2030-01-15T08:15:00+00:00' },
        422,
        'BOOKING_OFF_SLOT',
      ],
      [
        'two hours ending after closing',
        { startAt: '2030-01-15T22:00:00+00:00', durationHours: 2 },
        422,
        'OUTSIDE_OPENING_HOURS',
      ],
      ['a three-hour duration', { durationHours: 3 }, 400, 'VALIDATION_FAILED'],
      [
        'a start without an explicit offset',
        { startAt: '2030-01-15T09:00:00' },
        400,
        'VALIDATION_FAILED',
      ],
    ] as const)('rejects %s', async (_label, overrides, status, code) => {
      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: PADEL_1,
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 1,
          ...overrides,
        })
        .expect(status);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(code);
    });

    it('rejects a booking on a deactivated court with COURT_INACTIVE', async () => {
      await pool.query(`update courts set is_active = false where id = $1`, [PADEL_1]);

      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: PADEL_1,
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 1,
        })
        .expect(422);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('COURT_INACTIVE');
    });

    it('answers an unknown court with NOT_FOUND', async () => {
      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: '00000000-0000-4000-8000-000000000000',
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 1,
        })
        .expect(404);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('NOT_FOUND');
    });

    it('forbids an admin from creating a booking', async () => {
      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          courtId: PADEL_1,
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 1,
        })
        .expect(403);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /bookings attribution and price', () => {
    it('takes the owner from the token, not the request body', async () => {
      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: PADEL_1,
          userId: '11111111-1111-4111-8111-111111111102',
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 1,
        })
        .expect(201);

      expect(bookingSchema.parse(payload(response)).userId).toBe(USER_ID);
    });

    it('snapshots the price for a two-hour booking', async () => {
      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: PADEL_1,
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 2,
        })
        .expect(201);

      expect(bookingSchema.parse(payload(response)).priceCents).toBe(4_000);
    });
  });

  describe('POST /bookings/:id/cancel', () => {
    async function createBooking(): Promise<Booking> {
      const response = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courtId: PADEL_1,
          startAt: '2030-01-15T09:00:00+00:00',
          durationHours: 1,
        })
        .expect(201);

      return bookingSchema.parse(payload(response));
    }

    it('cancels the owner’s booking more than two hours before the start', async () => {
      const booking = await createBooking();

      const response = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(bookingSchema.parse(payload(response))).toMatchObject({
        id: booking.id,
        status: 'CANCELLED',
      });

      const retained = await pool.query<{ status: string }>(
        'select status from bookings where id = $1',
        [booking.id],
      );
      expect(retained.rows).toEqual([{ status: 'CANCELLED' }]);
    });

    it('cancels at exactly two hours before the start', async () => {
      const booking = await createBooking();
      now = new Date('2030-01-15T07:00:00Z');

      const response = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(bookingSchema.parse(payload(response)).status).toBe('CANCELLED');
    });

    it('refuses at one hour fifty-nine minutes before the start', async () => {
      const booking = await createBooking();
      now = new Date('2030-01-15T07:01:00Z');

      const response = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(409);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('CANCELLATION_WINDOW_CLOSED');
    });

    it('forbids another user from cancelling the booking', async () => {
      const booking = await createBooking();

      const response = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('FORBIDDEN');
    });

    it('forbids an admin from cancelling', async () => {
      const booking = await createBooking();

      const response = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('FORBIDDEN');
    });

    it('answers an unknown booking with NOT_FOUND', async () => {
      const response = await request(app)
        .post('/bookings/00000000-0000-4000-8000-000000000000/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('NOT_FOUND');
    });

    it('refuses to cancel an already cancelled booking', async () => {
      const booking = await createBooking();

      await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const response = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(409);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('BOOKING_ALREADY_CANCELLED');
    });

    it('returns the cancelled booking’s slot to availability', async () => {
      const booking = await createBooking();
      const slotAt = async (): Promise<string | undefined> => {
        const response = await request(app)
          .get(`/courts/${PADEL_1}/availability`)
          .query({ date: '2030-01-15' })
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        return availabilityResponseSchema
          .parse(payload(response))
          .find((slot) => slot.startsAt === '2030-01-15T09:00:00+00:00')?.status;
      };

      expect(await slotAt()).toBe('TAKEN');

      await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(await slotAt()).toBe('AVAILABLE');
    });
  });
});
