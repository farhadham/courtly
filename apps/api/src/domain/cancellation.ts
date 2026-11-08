import type { BookingStatus, ErrorCode } from '@courtly/contracts';

const CANCELLATION_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface CancellableBooking {
  userId: string;
  status: BookingStatus;
  startAt: Date;
}

export interface CancellationPolicyInput {
  booking: CancellableBooking;
  userId: string;
  now: Date;
}

/**
 * The contract enum is the single source of truth for wire codes; this picks
 * out the subset the domain can reject a cancellation with, so a rename there
 * flows through instead of needing a second edit here.
 */
export type CancellationRejection = Extract<
  ErrorCode,
  'FORBIDDEN' | 'BOOKING_ALREADY_CANCELLED' | 'CANCELLATION_WINDOW_CLOSED'
>;

export type CancellationValidation = { ok: true } | { ok: false; code: CancellationRejection };

export function validateCancellation({
  booking,
  userId,
  now,
}: CancellationPolicyInput): CancellationValidation {
  if (booking.userId !== userId) {
    return { ok: false, code: 'FORBIDDEN' };
  }

  if (booking.status === 'CANCELLED') {
    return { ok: false, code: 'BOOKING_ALREADY_CANCELLED' };
  }

  if (now.getTime() > booking.startAt.getTime() - CANCELLATION_WINDOW_MS) {
    return { ok: false, code: 'CANCELLATION_WINDOW_CLOSED' };
  }

  return { ok: true };
}
