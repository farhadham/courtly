import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { availabilityResponseSchema, apiErrorSchema } from '@courtly/contracts';
import { createApp } from '../../src/app';
import { signAuthToken } from '../../src/auth/tokens';
import { seedDatabase } from '../../src/db/seed';
import { createTestPool, testDatabaseUrl } from '../db/test-database';

const jwtSecret = 'test-secret';
const USER_ID = '11111111-1111-4111-8111-111111111101';
const PADEL_1 = '22222222-2222-4222-8222-222222222201';

let pool: Pool;
let app: ReturnType<typeof createApp>;
let userToken: string;
let now: Date;

describe('availability API', () => {
  beforeAll(() => {
    pool = createTestPool();
    userToken = signAuthToken({ sub: USER_ID, role: 'USER' }, jwtSecret);
  });

  beforeEach(async () => {
    await pool.query('truncate table bookings, courts, users cascade');
    await seedDatabase(testDatabaseUrl);
    // Seeded bookings move with the wall clock; availability tests own their
    // fixtures so slot expectations stay deterministic.
    await pool.query('delete from bookings');
    now = new Date('2030-01-15T06:00:00Z');
    app = createApp({ db: drizzle(pool), jwtSecret, now: () => now });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /courts/:id/availability', () => {
    it('returns one slot per opening hour and none outside the window', async () => {
      const response = await request(app)
        .get(`/courts/${PADEL_1}/availability`)
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const slots = availabilityResponseSchema.parse(response.body);

      expect(slots).toHaveLength(15);
      expect(slots[0]).toEqual({
        startsAt: '2030-01-15T08:00:00+00:00',
        status: 'AVAILABLE',
      });
      expect(slots.at(-1)).toEqual({
        startsAt: '2030-01-15T22:00:00+00:00',
        status: 'AVAILABLE',
      });
    });

    it.each([
      ['a missing date', {}],
      ['a non-ISO format', { date: '15/01/2030' }],
      ['an impossible calendar date', { date: '2030-02-30' }],
      ['a zero-padding error', { date: '2030-1-15' }],
    ])('rejects %s with VALIDATION_FAILED', async (_label, query) => {
      const response = await request(app)
        .get(`/courts/${PADEL_1}/availability`)
        .query(query)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('marks both slots of a confirmed two-hour booking as TAKEN', async () => {
      await pool.query(
        `insert into bookings
           (court_id, user_id, start_at, end_at, duration_hours, price_cents, status)
         values ($1, $2, $3, $4, 2, 4000, 'CONFIRMED')`,
        [PADEL_1, USER_ID, '2030-01-15T18:00:00Z', '2030-01-15T20:00:00Z'],
      );

      const response = await request(app)
        .get(`/courts/${PADEL_1}/availability`)
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const slots = availabilityResponseSchema.parse(response.body);
      const statusAt = (hour: number) =>
        slots.find((slot) => slot.startsAt === `2030-01-15T${hour}:00:00+00:00`)?.status;

      expect(statusAt(17)).toBe('AVAILABLE');
      expect(statusAt(18)).toBe('TAKEN');
      expect(statusAt(19)).toBe('TAKEN');
      expect(statusAt(20)).toBe('AVAILABLE');
    });

    it('leaves the slots of a cancelled booking AVAILABLE', async () => {
      await pool.query(
        `insert into bookings
           (court_id, user_id, start_at, end_at, duration_hours, price_cents, status)
         values ($1, $2, $3, $4, 2, 4000, 'CANCELLED')`,
        [PADEL_1, USER_ID, '2030-01-15T18:00:00Z', '2030-01-15T20:00:00Z'],
      );

      const response = await request(app)
        .get(`/courts/${PADEL_1}/availability`)
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const slots = availabilityResponseSchema.parse(response.body);
      const statusAt = (hour: number) =>
        slots.find((slot) => slot.startsAt === `2030-01-15T${hour}:00:00+00:00`)?.status;

      expect(statusAt(18)).toBe('AVAILABLE');
      expect(statusAt(19)).toBe('AVAILABLE');
    });

    it('returns slots that have already started today as PAST', async () => {
      now = new Date('2030-01-15T10:30:00Z');

      const response = await request(app)
        .get(`/courts/${PADEL_1}/availability`)
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const slots = availabilityResponseSchema.parse(response.body);
      const statusAt = (hour: number) =>
        slots.find(
          (slot) => slot.startsAt === `2030-01-15T${String(hour).padStart(2, '0')}:00:00+00:00`,
        )?.status;

      expect(slots).toHaveLength(15);
      expect(statusAt(8)).toBe('PAST');
      expect(statusAt(9)).toBe('PAST');
      expect(statusAt(10)).toBe('PAST');
      expect(statusAt(11)).toBe('AVAILABLE');
    });

    it('places slots on the Lisbon summer offset', async () => {
      now = new Date('2030-07-15T06:00:00Z');

      const response = await request(app)
        .get(`/courts/${PADEL_1}/availability`)
        .query({ date: '2030-07-15' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const slots = availabilityResponseSchema.parse(response.body);

      // 08:00 WEST is 07:00 UTC; 22:00 WEST is 21:00 UTC.
      expect(slots).toHaveLength(15);
      expect(slots[0]).toEqual({
        startsAt: '2030-07-15T07:00:00+00:00',
        status: 'AVAILABLE',
      });
      expect(slots.at(-1)?.startsAt).toBe('2030-07-15T21:00:00+00:00');
    });

    it('answers an unknown court with NOT_FOUND', async () => {
      const response = await request(app)
        .get('/courts/00000000-0000-4000-8000-000000000000/availability')
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('NOT_FOUND');
    });

    it('does not emit a partial slot at the end of a half-hour window', async () => {
      const courtId = '22222222-2222-4222-8222-222222222299';
      await pool.query(
        `insert into courts
           (id, name, sport_type, hourly_price_cents, opens_at, closes_at, is_active)
         values ($1, 'Squash 1', 'squash', 1800, '07:30', '09:30', true)`,
        [courtId],
      );

      const response = await request(app)
        .get(`/courts/${courtId}/availability`)
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const slots = availabilityResponseSchema.parse(response.body);

      expect(slots.map((slot) => slot.startsAt)).toEqual([
        '2030-01-15T07:30:00+00:00',
        '2030-01-15T08:30:00+00:00',
      ]);
    });
  });
});
