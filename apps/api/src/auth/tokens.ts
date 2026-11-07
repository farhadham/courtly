import jwt from 'jsonwebtoken';
import { USER_ROLES } from '@courtly/contracts';
import type { UserRole } from '@courtly/contracts';

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

const TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Issues the HS256 access token described by the API contract: one hour,
 * carrying only the user id and role.
 */
export function signAuthToken(payload: AuthTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/**
 * Verifies a token and narrows it to the contract payload. Signature, algorithm
 * and expiry are all checked by `jsonwebtoken`; the shape is checked here so a
 * token signed elsewhere with extra or missing claims cannot become a principal.
 */
export function verifyAuthToken(token: string, secret: string): AuthTokenPayload {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });

  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new Error('Token payload is missing a subject');
  }

  if (!USER_ROLES.includes(payload.role as UserRole)) {
    throw new Error('Token payload carries an unknown role');
  }

  return { sub: payload.sub, role: payload.role as UserRole };
}
