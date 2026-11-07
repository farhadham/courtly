import express from 'express';
import type { Express } from 'express';
import { createHealthRouter } from './routes/health';

/**
 * Builds the HTTP application without opening a socket.
 *
 * Keeping construction separate from listening lets tests exercise the real
 * middleware stack without a network port, and gives the server entry point a
 * single place to wire future routers.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(createHealthRouter());

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

  return app;
}
