import { courtOpeningWindow, localDateAt } from './availability';

const HOUR_MS = 60 * 60 * 1000;

export interface BookingCourt {
  opensAt: string;
  closesAt: string;
  isActive: boolean;
  hourlyPriceCents: number;
}

export type BookingRejection = 'BOOKING_IN_PAST' | 'OUTSIDE_OPENING_HOURS' | 'COURT_INACTIVE';

export type BookingValidation =
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

  return {
    ok: true,
    startAt,
    endAt,
    durationHours,
    priceCents: court.hourlyPriceCents * durationHours,
  };
}
