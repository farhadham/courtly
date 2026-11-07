import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, courtSchema } from '@courtly/contracts';
import { createApp } from '../../src/app';
import { signAuthToken } from '../../src/auth/tokens';
import { seedDatabase } from '../../src/db/seed';
import { createTestPool, testDatabaseUrl } from '../db/test-database';

const jwtSecret = 'test-secret';
const USER_ID = '11111111-1111-4111-8111-111111111101';
const ADMIN_ID = '11111111-1111-4111-8111-111111111103';

let pool: Pool;
let app: ReturnType<typeof createApp>;
let userToken: string;
let adminToken: string;

describe('courts API', () => {
  beforeAll(() => {
    pool = createTestPool();
    app = createApp({ db: drizzle(pool), jwtSecret });
  });

  beforeEach(async () => {
    await pool.query('truncate table bookings, courts, users cascade');
    await seedDatabase(testDatabaseUrl);
    userToken = signAuthToken({ sub: USER_ID, role: 'USER' }, jwtSecret);
    adminToken = signAuthToken({ sub: ADMIN_ID, role: 'ADMIN' }, jwtSecret);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /courts', () => {
    it('lists the active courts to an authenticated user', async () => {
      const response = await request(app)
        .get('/courts')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const body = courtSchema.array().parse(response.body);

      expect(body.map((court) => court.name)).toEqual(['Padel 1', 'Padel 2', 'Tennis 1']);
      expect(body[0]).toMatchObject({
        name: 'Padel 1',
        sportType: 'padel',
        hourlyPriceCents: 2_000,
        opensAt: '08:00',
        closesAt: '23:00',
        isActive: true,
      });
    });

    it('filters by sport type case-insensitively', async () => {
      const response = await request(app)
        .get('/courts')
        .query({ sport: 'PADEL' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(
        courtSchema
          .array()
          .parse(response.body)
          .map((court) => court.name),
      ).toEqual(['Padel 1', 'Padel 2']);
    });

    it('hides a deactivated court from users even when includeInactive is requested', async () => {
      await pool.query(`update courts set is_active = false where name = 'Tennis 1'`);

      const response = await request(app)
        .get('/courts')
        .query({ includeInactive: 'true' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(
        courtSchema
          .array()
          .parse(response.body)
          .map((court) => court.name),
      ).toEqual(['Padel 1', 'Padel 2']);
    });

    it('lets an admin include deactivated courts', async () => {
      await pool.query(`update courts set is_active = false where name = 'Tennis 1'`);

      const response = await request(app)
        .get('/courts')
        .query({ includeInactive: 'true' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = courtSchema.array().parse(response.body);

      expect(body.map((court) => court.name)).toEqual(['Padel 1', 'Padel 2', 'Tennis 1']);
      expect(body.find((court) => court.name === 'Tennis 1')).toMatchObject({ isActive: false });
    });
  });

  describe('POST /admin/courts', () => {
    it('lets an admin create a court with a new sport label', async () => {
      const response = await request(app)
        .post('/admin/courts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Squash 1',
          sportType: 'squash',
          hourlyPriceCents: 1_800,
          opensAt: '07:30',
          closesAt: '21:00',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Squash 1',
        sportType: 'squash',
        hourlyPriceCents: 1_800,
        opensAt: '07:30',
        closesAt: '21:00',
        isActive: true,
      });
      expect(courtSchema.parse(response.body).id).toBeTypeOf('string');

      const listing = await request(app)
        .get('/courts')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(
        courtSchema
          .array()
          .parse(listing.body)
          .map((court) => court.name),
      ).toContain('Squash 1');
    });

    it('forbids a USER from creating a court', async () => {
      await request(app)
        .post('/admin/courts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Squash 1',
          sportType: 'squash',
          hourlyPriceCents: 1_800,
          opensAt: '07:30',
          closesAt: '21:00',
        })
        .expect(403);
    });

    it.each([
      ['zero price', { hourlyPriceCents: 0 }],
      ['negative price', { hourlyPriceCents: -100 }],
      ['fractional price', { hourlyPriceCents: 1_500.5 }],
      ['empty sport label', { sportType: '', hourlyPriceCents: 1_800 }],
      [
        'sport label longer than 50 characters',
        { sportType: 'x'.repeat(51), hourlyPriceCents: 1_800 },
      ],
      ['malformed opening time', { opensAt: '8:00', hourlyPriceCents: 1_800 }],
      [
        'closing time not after opening',
        { opensAt: '18:00', closesAt: '18:00', hourlyPriceCents: 1_800 },
      ],
    ])('rejects a court with %s', async (_label, overrides) => {
      const response = await request(app)
        .post('/admin/courts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Squash 1',
          sportType: 'squash',
          opensAt: '07:30',
          closesAt: '21:00',
          ...overrides,
        })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects a court whose name is already taken', async () => {
      const response = await request(app)
        .post('/admin/courts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Padel 1',
          sportType: 'padel',
          hourlyPriceCents: 2_000,
          opensAt: '08:00',
          closesAt: '23:00',
        })
        .expect(409);

      expect(response.body).toEqual({
        error: {
          code: 'COURT_NAME_TAKEN',
          message: 'A court with this name already exists',
          details: {},
        },
      });
    });
  });

  describe('PATCH /admin/courts/:id', () => {
    it('lets an admin edit a court', async () => {
      const response = await request(app)
        .patch('/admin/courts/22222222-2222-4222-8222-222222222201')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Padel One',
          sportType: 'squash',
          hourlyPriceCents: 2_500,
          opensAt: '09:00',
          closesAt: '22:00',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: '22222222-2222-4222-8222-222222222201',
        name: 'Padel One',
        sportType: 'squash',
        hourlyPriceCents: 2_500,
        opensAt: '09:00',
        closesAt: '22:00',
        isActive: true,
      });

      const detail = await request(app)
        .get('/courts/22222222-2222-4222-8222-222222222201')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(detail.body).toMatchObject({ name: 'Padel One', hourlyPriceCents: 2_500 });
    });

    it('deactivates a court without removing it from the facility', async () => {
      const response = await request(app)
        .patch('/admin/courts/22222222-2222-4222-8222-222222222201')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(response.body).toMatchObject({ name: 'Padel 1', isActive: false });

      const listing = await request(app)
        .get('/courts')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(
        courtSchema
          .array()
          .parse(listing.body)
          .map((court) => court.name),
      ).not.toContain('Padel 1');

      const detail = await request(app)
        .get('/courts/22222222-2222-4222-8222-222222222201')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(detail.body).toMatchObject({ name: 'Padel 1', isActive: false });
    });

    it('rejects renaming a court to a name already taken', async () => {
      const response = await request(app)
        .patch('/admin/courts/22222222-2222-4222-8222-222222222201')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Padel 2' })
        .expect(409);

      expect(response.body).toEqual({
        error: {
          code: 'COURT_NAME_TAKEN',
          message: 'A court with this name already exists',
          details: {},
        },
      });
    });

    it('answers an unknown court with NOT_FOUND', async () => {
      await request(app)
        .patch('/admin/courts/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Padel One' })
        .expect(404);
    });

    it('forbids a USER from editing a court', async () => {
      await request(app)
        .patch('/admin/courts/22222222-2222-4222-8222-222222222201')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Padel One' })
        .expect(403);
    });

    it.each([
      ['an empty body', {}],
      ['a zero price', { hourlyPriceCents: 0 }],
      ['an empty name', { name: '' }],
      ['a closing time before the existing opening time', { closesAt: '07:00' }],
    ])('rejects %s', async (_label, body) => {
      const response = await request(app)
        .patch('/admin/courts/22222222-2222-4222-8222-222222222201')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('GET /courts/:id', () => {
    it('returns a court by id', async () => {
      const response = await request(app)
        .get('/courts/22222222-2222-4222-8222-222222222201')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: '22222222-2222-4222-8222-222222222201',
        name: 'Padel 1',
        sportType: 'padel',
        hourlyPriceCents: 2_000,
        opensAt: '08:00',
        closesAt: '23:00',
        isActive: true,
      });
    });

    it('still returns a deactivated court so its bookings can resolve', async () => {
      await pool.query(`update courts set is_active = false where name = 'Tennis 1'`);

      const response = await request(app)
        .get('/courts/22222222-2222-4222-8222-222222222203')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ name: 'Tennis 1', isActive: false });
    });

    it('answers an unknown court with NOT_FOUND', async () => {
      const response = await request(app)
        .get('/courts/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Court not found',
          details: {},
        },
      });
    });
  });
});
