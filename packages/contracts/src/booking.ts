import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { BOOKING_STATUSES, bookings } from './schema';

export const bookingRowSchema = createSelectSchema(bookings);
export const bookingInsertSchema = createInsertSchema(bookings);

/**
 * A booking as the API returns it: camelCase, with instants in the `+00:00`
 * form the availability endpoint uses. `priceCents` is the value snapshotted
 * when the booking was created, not the court's current price.
 */
export const bookingSchema = z.object({
  id: z.uuid(),
  courtId: z.uuid(),
  userId: z.uuid(),
  startAt: z.iso.datetime({ offset: true }),
  endAt: z.iso.datetime({ offset: true }),
  durationHours: z.union([z.literal(1), z.literal(2)]),
  priceCents: z.number().int().nonnegative(),
  status: z.enum(BOOKING_STATUSES),
  createdAt: z.iso.datetime({ offset: true }),
});

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

export type Booking = z.infer<typeof bookingSchema>;
export type BookingRow = z.infer<typeof bookingRowSchema>;
export type BookingCreate = z.infer<typeof bookingCreateSchema>;
