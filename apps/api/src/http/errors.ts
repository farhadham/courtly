import type { ErrorCode } from '@courtly/contracts';
import type { NextFunction, Request, Response } from 'express';

/**
 * A failure that already knows its place in the API error contract. Routers and
 * middleware throw or forward these; the error middleware is the only place
 * that turns them into HTTP responses.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Express error middleware. Known failures keep their status, code, message and
 * details; malformed JSON becomes `VALIDATION_FAILED`; anything unexpected is
 * logged and reported without leaking internals. The `INTERNAL_ERROR` fallback
 * sits outside the closed business-code enum because the caller cannot act on it.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request body is not valid JSON',
        details: {},
      },
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: {},
    },
  });
}
