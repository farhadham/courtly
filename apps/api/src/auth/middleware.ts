import type { RequestHandler } from 'express';
import type { UserRole } from '@courtly/contracts';
import { ApiError } from '../http/errors';
import { verifyAuthToken } from './tokens';
import type { AuthTokenPayload } from './tokens';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthTokenPayload;
  }
}

/**
 * Rejects requests without a valid `Authorization: Bearer <token>` header and
 * attaches the verified principal to the request.
 */
export function requireAuth(secret: string): RequestHandler {
  return (req, _res, next) => {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');

    if (!match?.[1]) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    try {
      req.auth = verifyAuthToken(match[1], secret);
    } catch {
      next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
      return;
    }

    next();
  };
}

/**
 * Authenticates but refuses principals whose role is not the one the mount
 * point requires. It always runs after `requireAuth`.
 */
export function requireRole(role: UserRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (req.auth.role !== role) {
      next(new ApiError(403, 'FORBIDDEN', `This route requires the ${role} role`));
      return;
    }

    next();
  };
}
