import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { HealthResponse } from '@courtly/contracts';
import { createApp } from '../../src/app';

describe('GET /health', () => {
  const app = createApp();

  it('reports the API as healthy', async () => {
    const response = await request(app).get('/health').expect(200);
    const body = response.body as HealthResponse;

    expect(body).toMatchObject({ status: 'ok' });
    expect(body.uptimeSeconds).toBeTypeOf('number');
  });

  it('answers unknown routes in the error contract', async () => {
    const response = await request(app).get('/does-not-exist').expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: {},
      },
    });
  });
});
