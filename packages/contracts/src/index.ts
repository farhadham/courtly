/**
 * Shared API contract.
 *
 * Everything the API and the web app agree on lives here. Zod schemas are the
 * single source of truth: TypeScript types are inferred from them, so a change
 * to a schema is a compile error on both sides rather than a runtime surprise.
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { USER_ROLES, bookings, courts, users } from './schema';

export {
  BOOKING_STATUSES,
  USER_ROLES,
  bookings,
  courts,
  users,
  type BookingStatus,
  type UserRole,
} from './schema';

export const CONTRACTS_VERSION = '0.1.0';

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
}

/**
 * The closed set of business failure codes from the API error contract. Every
 * failure that a caller can act on carries exactly one of these codes.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'SLOT_TAKEN',
  'COURT_NAME_TAKEN',
  'CANCELLATION_WINDOW_CLOSED',
  'BOOKING_IN_PAST',
  'OUTSIDE_OPENING_HOURS',
  'COURT_INACTIVE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.string(), z.unknown()),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

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

export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const userRowSchema = createSelectSchema(users);
export const courtRowSchema = createSelectSchema(courts);
export const bookingRowSchema = createSelectSchema(bookings);

export const userInsertSchema = createInsertSchema(users);
export const courtInsertSchema = createInsertSchema(courts);
export const bookingInsertSchema = createInsertSchema(bookings);

/**
 * A local wall-clock time in the `HH:MM` form the court API speaks.
 */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time in HH:MM');

/**
 * A court as the API returns it. Times are normalised to `HH:MM`; the database
 * stores them with seconds.
 */
export const courtSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sportType: z.string(),
  hourlyPriceCents: z.number().int(),
  opensAt: timeOfDaySchema,
  closesAt: timeOfDaySchema,
  isActive: z.boolean(),
});

export type Court = z.infer<typeof courtSchema>;

export const courtIdParamSchema = z.object({ id: z.uuid() });

/**
 * Court fields accepted when an admin creates one. `isActive` defaults to true
 * at the persistence layer when omitted.
 */
const courtFieldsSchema = z.object({
  name: z.string().trim().min(1),
  sportType: z.string().trim().min(1).max(50),
  hourlyPriceCents: z.number().int().positive(),
  opensAt: timeOfDaySchema,
  closesAt: timeOfDaySchema,
  isActive: z.boolean().optional(),
});

export const courtCreateSchema = courtFieldsSchema.refine(
  (court) => court.closesAt > court.opensAt,
  {
    message: 'closesAt must be after opensAt',
    path: ['closesAt'],
  },
);

export const courtUpdateSchema = courtFieldsSchema.partial();

export type CourtCreate = z.infer<typeof courtCreateSchema>;
export type CourtUpdate = z.infer<typeof courtUpdateSchema>;

/**
 * Query accepted by `GET /courts`. `includeInactive` only has an effect for an
 * admin; the browser router ignores it for everyone else.
 */
export const courtListQuerySchema = z.object({
  sport: z.string().min(1).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

export type CourtListQuery = z.infer<typeof courtListQuerySchema>;

/**
 * The one-or-two-hour booking request accepted by `POST /bookings`.
 *
 * `startAt` is an ISO-8601 instant with an explicit offset, normalised to a
 * `Date` so the persistence layer never parses a date string itself.
 */
export const bookingCreateSchema = z.object({
  courtId: z.uuid(),
  startAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  durationHours: z.union([z.literal(1), z.literal(2)]),
});

export type UserRow = z.infer<typeof userRowSchema>;
export type CourtRow = z.infer<typeof courtRowSchema>;
export type BookingRow = z.infer<typeof bookingRowSchema>;
export type BookingCreate = z.infer<typeof bookingCreateSchema>;
