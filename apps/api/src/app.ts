import express from 'express';
import type { Express } from 'express';
import { requireAuth, requireRole } from './auth/middleware';
import type { AppDatabase } from './db/client';
import { errorHandler } from './http/errors';
import { createAdminRouter } from './routes/admin';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter } from './routes/health';

export interface AppDependencies {
  db: AppDatabase;
  jwtSecret: string;
}

/**
 * Builds the HTTP application without opening a socket.
 *
 * Keeping construction separate from listening lets tests exercise the real
 * middleware stack without a network port, and gives the server entry point a
 * single place to wire future routers.
 */
export function createApp({ db, jwtSecret }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  // Operational liveness probe: not part of the business API surface.
  app.use(createHealthRouter());
  app.use('/auth', createAuthRouter({ db, jwtSecret }));

  // Everything mounted below this line requires a valid token. Login is the
  // only public business route.
  app.use(requireAuth(jwtSecret));
  app.use('/admin', requireRole('ADMIN'), createAdminRouter());

  // Unknown routes answer in the error contract rather than Express's HTML
  // default, so API consumers only ever parse one response shape.
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: {},
      },
    });
  });

  app.use(errorHandler);

  return app;
}
