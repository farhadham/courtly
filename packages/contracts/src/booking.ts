import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { BOOKING_STATUSES, bookings } from './schema';

export const bookingRowSchema = createSelectSchema(bookings);

export const bookingIdParamSchema = z.object({ id: z.uuid() });

export const BOOKING_SCOPES = ['upcoming', 'past'] as const;
export type BookingScope = (typeof BOOKING_SCOPES)[number];

/**
 * Query accepted by `GET /bookings/me`. `upcoming` is a confirmed booking that
 * starts strictly after `now()`; `past` is everything else — bookings whose
 * start has arrived, plus cancelled bookings.
 */
export const myBookingsQuerySchema = z.object({
  scope: z.enum(BOOKING_SCOPES),
});

/** Query accepted by `GET /admin/bookings`: one Lisbon calendar day. */
export const adminBookingsQuerySchema = z.object({
  date: z.iso.date(),
});

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

/** The `GET /bookings/me` payload: the caller's own booking history. */
export const bookingListSchema = z.array(bookingSchema);

/**
 * The admin day view payload: every booking that starts on the requested
 * Lisbon day, plus the day's revenue. Revenue is summed from the snapshotted
 * `priceCents` of non-cancelled bookings (ADR-0002).
 */
export const adminBookingsResponseSchema = z.object({
  bookings: z.array(bookingSchema),
  totalRevenueCents: z.number().int().nonnegative(),
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
