import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { USER_ROLES, users } from './schema';

/**
 * The authenticated principal returned by `POST /auth/login` and encoded in
 * the JWT. It never includes the password hash.
 */
export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(USER_ROLES),
});

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  user: authUserSchema,
});

export const userRowSchema = createSelectSchema(users);
export const userInsertSchema = createInsertSchema(users);

export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type UserRow = z.infer<typeof userRowSchema>;
