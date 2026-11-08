import { and, asc, desc, eq, gt, lte, or } from 'drizzle-orm';
import { Router } from 'express';
import {
  bookingCreateSchema,
  bookingIdParamSchema,
  bookings,
  courts,
  myBookingsQuerySchema,
} from '@courtly/contracts';
import type { Booking, BookingRow } from '@courtly/contracts';
import { requireAuthUser, requireRole } from '../auth/middleware';
import type { AppDatabase } from '../db/client';
import { isExclusionViolation } from '../db/errors';
import { formatInstant } from '../domain/availability';
import { validateBooking } from '../domain/booking';
import type { BookingRejection } from '../domain/booking';
import { validateCancellation } from '../domain/cancellation';
import type { CancellationRejection } from '../domain/cancellation';
import { ApiError } from '../http/errors';
import { data } from '../http/respond';

export interface BookingsRouterDependencies {
  db: AppDatabase;
  now?: () => Date;
}

const REJECTION_MESSAGES: Record<BookingRejection, string> = {
  BOOKING_IN_PAST: 'A booking cannot start at or before the current time',
  BOOKING_OFF_SLOT:
    'A booking must start on a slot boundary (a whole number of hours after opening)',
  OUTSIDE_OPENING_HOURS: 'The booking must fit inside the court opening hours',
  COURT_INACTIVE: 'This court is not accepting new bookings',
};

const CANCELLATION_STATUS: Record<CancellationRejection, number> = {
  FORBIDDEN: 403,
  BOOKING_ALREADY_CANCELLED: 409,
  CANCELLATION_WINDOW_CLOSED: 409,
};

const CANCELLATION_MESSAGES: Record<CancellationRejection, string> = {
  FORBIDDEN: 'Only the booking owner may cancel it',
  BOOKING_ALREADY_CANCELLED: 'This booking is already cancelled',
  CANCELLATION_WINDOW_CLOSED: 'A booking can no longer be cancelled inside its two-hour window',
};

export function toBookingResponse(booking: BookingRow): Booking {
  return {
    id: booking.id,
    courtId: booking.courtId,
    userId: booking.userId,
    startAt: formatInstant(booking.startAt),
    endAt: formatInstant(booking.endAt),
    durationHours: booking.durationHours as Booking['durationHours'],
    priceCents: booking.priceCents,
    status: booking.status,
    createdAt: formatInstant(booking.createdAt),
  };
}

/**
 * Booking creation for users. Admins manage courts and observe bookings, but
 * they do not book, so the role guard sits on the write route rather than the
 * whole router.
 */
export function createBookingsRouter({
  db,
  now = () => new Date(),
}: BookingsRouterDependencies): Router {
  const router = Router();

  /**
   * The caller's own history, split around the injected clock. Ownership comes
   * from the token rather than the query string, so another user's bookings are
   * unreachable by construction. `upcoming` follows the booking rule that a
   * start at or before `now()` is no longer future (`start_at <= now()` is
   * rejected on creation), so only confirmed rows strictly after `now()` count.
   * Cancelled rows stay visible as history, never as plans.
   */
  router.get('/me', async (req, res) => {
    const parsed = myBookingsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid booking scope', {
        issues: parsed.error.issues,
      });
    }

    const userId = requireAuthUser(req).sub;

    const isUpcoming = parsed.data.scope === 'upcoming';
    const instant = now();
    const scope = isUpcoming
      ? and(gt(bookings.startAt, instant), eq(bookings.status, 'CONFIRMED'))
      : or(lte(bookings.startAt, instant), eq(bookings.status, 'CANCELLED'));
    const rows = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.userId, userId), scope))
      .orderBy(isUpcoming ? asc(bookings.startAt) : desc(bookings.startAt));

    res.json(data(rows.map(toBookingResponse)));
  });

  router.post('/', requireRole('USER'), async (req, res) => {
    const parsed = bookingCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid booking', {
        issues: parsed.error.issues,
      });
    }

    const userId = requireAuthUser(req).sub;

    const [court] = await db
      .select()
      .from(courts)
      .where(eq(courts.id, parsed.data.courtId))
      .limit(1);

    if (!court) {
      throw new ApiError(404, 'NOT_FOUND', 'Court not found');
    }

    const validated = validateBooking({
      court,
      startAt: parsed.data.startAt,
      durationHours: parsed.data.durationHours,
      now: now(),
    });

    if (!validated.ok) {
      throw new ApiError(422, validated.code, REJECTION_MESSAGES[validated.code]);
    }

    const [booking] = await db
      .insert(bookings)
      .values({
        courtId: court.id,
        userId,
        startAt: validated.startAt,
        endAt: validated.endAt,
        durationHours: validated.durationHours,
        priceCents: validated.priceCents,
      })
      .returning()
      .catch((error: unknown) => {
        if (isExclusionViolation(error)) {
          throw new ApiError(409, 'SLOT_TAKEN', 'This slot is already booked');
        }

        throw error;
      });

    if (!booking) {
      throw new Error('Booking insert did not return a row');
    }

    res.status(201).json(data(toBookingResponse(booking)));
  });

  /**
   * Cancellation is a state transition rather than a delete: the row survives
   * with `status = 'CANCELLED'`, which is what frees its slots and keeps it out
   * of revenue. Only a USER reaches this handler; admins are refused at the
   * role guard, and the domain function refuses anyone who is not the owner.
   */
  router.post('/:id/cancel', requireRole('USER'), async (req, res) => {
    const parsedParams = bookingIdParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
    }

    const userId = requireAuthUser(req).sub;

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, parsedParams.data.id))
      .limit(1);

    if (!booking) {
      throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
    }

    const validated = validateCancellation({ booking, userId, now: now() });

    if (!validated.ok) {
      throw new ApiError(
        CANCELLATION_STATUS[validated.code],
        validated.code,
        CANCELLATION_MESSAGES[validated.code],
      );
    }

    // The status predicate makes the transition idempotent under concurrency:
    // a second cancellation racing this one updates no rows and gets 409.
    const [cancelled] = await db
      .update(bookings)
      .set({ status: 'CANCELLED' })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'CONFIRMED')))
      .returning();

    if (!cancelled) {
      throw new ApiError(409, 'BOOKING_ALREADY_CANCELLED', 'This booking is already cancelled');
    }

    res.json(data(toBookingResponse(cancelled)));
  });

  return router;
}
