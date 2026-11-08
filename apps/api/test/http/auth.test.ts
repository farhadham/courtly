import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginResponseSchema } from '@courtly/contracts';
import { createApp } from '../../src/app';
import { seedDatabase } from '../../src/db/seed';
import { createTestPool, testDatabaseUrl } from '../db/test-database';
import { payload } from './payload';

const jwtSecret = 'test-secret';
let pool: Pool;
let app: ReturnType<typeof createApp>;

describe('authentication', () => {
  beforeAll(async () => {
    pool = createTestPool();
    await pool.query('truncate table bookings, courts, users cascade');
    await seedDatabase(testDatabaseUrl);
    app = createApp({ db: drizzle(pool), jwtSecret });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns a token and the user for valid seeded credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'user@courtly.test', password: 'courtly123' })
      .expect(200);
    const body = loginResponseSchema.parse(payload(response));

    expect(body).toMatchObject({
      user: {
        email: 'user@courtly.test',
        role: 'USER',
      },
    });
    expect(body.token).toBeTypeOf('string');
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a wrong password with the INVALID_CREDENTIALS contract error', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'user@courtly.test', password: 'not-the-password' })
      .expect(401);

    expect(response.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        details: {},
      },
    });
  });

  it('rejects a protected request that carries no token', async () => {
    const response = await request(app).get('/admin/courts').expect(401);

    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        details: {},
      },
    });
  });

  it('forbids a USER from calling an admin route', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'user@courtly.test', password: 'courtly123' })
      .expect(200);
    const { token } = loginResponseSchema.parse(payload(login));

    const response = await request(app)
      .get('/admin/courts')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'This route requires the ADMIN role',
        details: {},
      },
    });
  });

  it('lets an ADMIN through the role guard', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@courtly.test', password: 'courtly123' })
      .expect(200);
    const { token, user } = loginResponseSchema.parse(payload(login));

    expect(user.role).toBe('ADMIN');

    // The admin router is empty until the court-management phase, so passing
    // both guards lands on the contract's NOT_FOUND handler rather than 401/403.
    await request(app).get('/admin/courts').set('Authorization', `Bearer ${token}`).expect(404);
  });
});
