/**
 * Shared API contract.
 *
 * Everything the API and the web app agree on lives here. Zod schemas are the
 * single source of truth: TypeScript types are inferred from them, so a change
 * to a schema is a compile error on both sides rather than a runtime surprise.
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { bookings, courts, users } from './schema';

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

export const userRowSchema = createSelectSchema(users);
export const courtRowSchema = createSelectSchema(courts);
export const bookingRowSchema = createSelectSchema(bookings);

export const userInsertSchema = createInsertSchema(users);
export const courtInsertSchema = createInsertSchema(courts);
export const bookingInsertSchema = createInsertSchema(bookings);

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
