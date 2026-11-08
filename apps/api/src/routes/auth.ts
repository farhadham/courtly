import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { loginRequestSchema, users } from '@courtly/contracts';
import type { LoginResponse } from '@courtly/contracts';
import { signAuthToken } from '../auth/tokens';
import type { AppDatabase } from '../db/client';
import { ApiError } from '../http/errors';
import { data } from '../http/respond';

export interface AuthRouterDependencies {
  db: AppDatabase;
  jwtSecret: string;
}

/**
 * The only public business route. Credentials are verified against the seeded
 * bcrypt hash, and a failed lookup and a wrong password are indistinguishable
 * to the caller.
 */
export function createAuthRouter({ db, jwtSecret }: AuthRouterDependencies): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const parsed = loginRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid login request', {
        issues: parsed.error.issues,
      });
    }

    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);

    if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    const body: LoginResponse = {
      token: signAuthToken({ sub: user.id, role: user.role }, jwtSecret),
      user: { id: user.id, email: user.email, role: user.role },
    };

    res.json(data(body));
  });

  return router;
}
