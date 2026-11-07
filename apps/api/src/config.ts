import { loadEnvironment } from './db/config';

/**
 * The JWT signing secret is deployment configuration, not a default. Failing
 * loudly here is better than signing tokens with an empty or missing secret.
 */
export function jwtSecret(): string {
  loadEnvironment();

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET must be set');
  }

  return secret;
}
