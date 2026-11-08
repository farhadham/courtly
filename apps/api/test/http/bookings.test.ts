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
const ADMIN_ID = '11111111-1111-4111-8111-111111111103';
const PADEL_1 = '22222222-2222-4222-8222-222222222201';

let pool: Pool;
let app: ReturnType<typeof createApp>;
let userToken: string;
let adminToken: string;
let now: Date;

describe('bookings API', () => {
  beforeAll(() => {
    pool = createTestPool();
    userToken = signAuthToken({ sub: USER_ID, role: 'USER' }, jwtSecret);
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
});
