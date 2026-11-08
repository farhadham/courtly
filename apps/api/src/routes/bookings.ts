import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { bookingCreateSchema, bookings, courts } from '@courtly/contracts';
import type { Booking, BookingRow } from '@courtly/contracts';
import { requireRole } from '../auth/middleware';
import type { AppDatabase } from '../db/client';
import { isExclusionViolation } from '../db/errors';
import { formatInstant } from '../domain/availability';
import { validateBooking } from '../domain/booking';
import type { BookingRejection } from '../domain/booking';
import { ApiError } from '../http/errors';
import { data } from '../http/respond';

export interface BookingsRouterDependencies {
  db: AppDatabase;
  now?: () => Date;
}

const REJECTION_MESSAGES: Record<BookingRejection, string> = {
  BOOKING_IN_PAST: 'A booking cannot start at or before the current time',
  OUTSIDE_OPENING_HOURS: 'The booking must fit inside the court opening hours',
  COURT_INACTIVE: 'This court is not accepting new bookings',
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

  router.post('/', requireRole('USER'), async (req, res) => {
    const parsed = bookingCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid booking', {
        issues: parsed.error.issues,
      });
    }

    const userId = req.auth?.sub;

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

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

  return router;
}
