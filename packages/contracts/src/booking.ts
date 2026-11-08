import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { bookings } from './schema';

export const bookingRowSchema = createSelectSchema(bookings);
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

export type BookingRow = z.infer<typeof bookingRowSchema>;
export type BookingCreate = z.infer<typeof bookingCreateSchema>;
