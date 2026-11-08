import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ErrorCode } from '@courtly/contracts';
import { ApiRequestError, fetchData, setUnauthorizedHandler } from './api';

const payloadSchema = z.object({ ok: z.boolean() });

function errorResponse(status: number, code: ErrorCode): Response {
  return new Response(JSON.stringify({ error: { code, message: 'Rejected', details: {} } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(response: Response) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe('session invalidation', () => {
  it('drops the session only when the failure is UNAUTHORIZED', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(errorResponse(401, 'UNAUTHORIZED'));

    await expect(fetchData('/bookings/me', payloadSchema)).rejects.toBeInstanceOf(ApiRequestError);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('keeps the session for a wrong password', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(errorResponse(401, 'INVALID_CREDENTIALS'));

    const failure = await fetchData('/auth/login', payloadSchema).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiRequestError);
    expect((failure as ApiRequestError).code).toBe('INVALID_CREDENTIALS');
    expect(handler).not.toHaveBeenCalled();
  });

  it('treats a 401 without an error envelope as a dead session', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(new Response('<html>Unauthorized</html>', { status: 401 }));

    await expect(fetchData('/courts', payloadSchema)).rejects.toBeInstanceOf(ApiRequestError);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
