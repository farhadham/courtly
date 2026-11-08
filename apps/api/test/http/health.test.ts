import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiData, HealthResponse } from '@courtly/contracts';
import { createApp } from '../../src/app';
import { signAuthToken } from '../../src/auth/tokens';
import { createTestPool } from '../db/test-database';

const jwtSecret = 'test-secret';
let pool: Pool;
let app: ReturnType<typeof createApp>;

describe('GET /health', () => {
  beforeAll(() => {
    pool = createTestPool();
    app = createApp({ db: drizzle(pool), jwtSecret });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('reports the API as healthy', async () => {
    const response = await request(app).get('/health').expect(200);
    const envelope = response.body as ApiData<HealthResponse>;

    expect(Object.keys(envelope)).toEqual(['data']);
    expect(envelope.data).toMatchObject({ status: 'ok' });
    expect(envelope.data.uptimeSeconds).toBeTypeOf('number');
  });

  it('answers authenticated unknown routes in the error contract', async () => {
    const token = signAuthToken(
      { sub: '11111111-1111-4111-8111-111111111101', role: 'USER' },
      jwtSecret,
    );
    const response = await request(app)
      .get('/does-not-exist')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: {},
      },
    });
  });
});
