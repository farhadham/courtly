import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { signAuthToken, verifyAuthToken } from '../../src/auth/tokens';

const secret = 'unit-test-secret';
const principal = { sub: '11111111-1111-4111-8111-111111111101', role: 'ADMIN' as const };

describe('auth tokens', () => {
  it('issues an HS256 token carrying sub and role with a one-hour expiry', () => {
    const token = signAuthToken(principal, secret);
    const decoded = jwt.decode(token, { complete: true });

    expect(decoded?.header.alg).toBe('HS256');

    const claims = decoded?.payload as jwt.JwtPayload;
    expect(claims.sub).toBe(principal.sub);
    expect(claims.role).toBe('ADMIN');
    expect(claims.exp).toBeTypeOf('number');
    expect(claims.iat).toBeTypeOf('number');
    expect(claims.exp! - claims.iat!).toBe(3600);

    expect(verifyAuthToken(token, secret)).toEqual(principal);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signAuthToken(principal, secret);

    expect(() => verifyAuthToken(token, 'another-secret')).toThrow();
  });
});
