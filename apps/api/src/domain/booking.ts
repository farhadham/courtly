import type { ErrorCode } from '@courtly/contracts';
import { courtOpeningWindow, localDateAt } from './availability';
import { HOUR_MS } from './time';

interface BookingCourt {
  opensAt: string;
  closesAt: string;
  isActive: boolean;
  hourlyPriceCents: number;
}

/**
 * The contract enum is the single source of truth for wire codes; this picks
 * out the subset the domain can reject a booking with, so a rename there flows
 * through instead of needing a second edit here.
 */
export type BookingRejection = Extract<
  ErrorCode,
  'BOOKING_IN_PAST' | 'BOOKING_OFF_SLOT' | 'OUTSIDE_OPENING_HOURS' | 'COURT_INACTIVE'
>;

type BookingValidation =
  | {
      ok: true;
      startAt: Date;
      endAt: Date;
      durationHours: 1 | 2;
      priceCents: number;
    }
  | { ok: false; code: BookingRejection };

/**
 * Applies the booking business rules that do not need the database. The caller
 * resolves the court and the clock; this function only decides whether the
 * requested interval is legal and what the booking will cost.
 */
export function validateBooking({
  court,
  startAt,
  durationHours,
  now,
}: {
  court: BookingCourt;
  startAt: Date;
  durationHours: 1 | 2;
  now: Date;
}): BookingValidation {
  if (!court.isActive) {
    return { ok: false, code: 'COURT_INACTIVE' };
  }

  if (startAt.getTime() <= now.getTime()) {
    return { ok: false, code: 'BOOKING_IN_PAST' };
  }

  const endAt = new Date(startAt.getTime() + durationHours * HOUR_MS);
  const { opensAt, closesAt } = courtOpeningWindow(court, localDateAt(startAt));

  if (startAt.getTime() < opensAt.getTime() || endAt.getTime() > closesAt.getTime()) {
    return { ok: false, code: 'OUTSIDE_OPENING_HOURS' };
  }

  // Bookings are made in whole hours: `startAt` must sit on the same slot grid
  // `availabilityForDay` emits, anchored to the court's opening time (GLOSSARY:
  // a slot is "the granularity at which bookings are made").
  if ((startAt.getTime() - opensAt.getTime()) % HOUR_MS !== 0) {
    return { ok: false, code: 'BOOKING_OFF_SLOT' };
  }

  return {
    ok: true,
    startAt,
    endAt,
    durationHours,
    priceCents: court.hourlyPriceCents * durationHours,
  };
}
