import { Router } from 'express';
import type { HealthResponse } from '@courtly/contracts';
import { data } from '../http/respond';

/**
 * Liveness probe used by Docker and by the web app's connection banner.
 */
export function createHealthRouter(): Router {
  const startedAt = Date.now();
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    };

    res.json(data(body));
  });

  return router;
}
