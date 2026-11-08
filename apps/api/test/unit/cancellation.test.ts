import { beforeEach, describe, expect, it } from 'vitest';
import { validateCancellation } from '../../src/domain/cancellation';

const OWNER_ID = '11111111-1111-4111-8111-111111111101';

let now: Date;

beforeEach(() => {
  now = new Date('2030-01-15T06:00:00Z');
});

function confirmedBooking(startAt = '2030-01-15T09:00:00Z') {
  return {
    userId: OWNER_ID,
    status: 'CONFIRMED' as const,
    startAt: new Date(startAt),
  };
}

describe('validateCancellation', () => {
  it('allows a cancellation more than two hours before the start', () => {
    now = new Date('2030-01-15T06:00:00Z');

    const result = validateCancellation({
      booking: confirmedBooking(),
      userId: OWNER_ID,
      now,
    });

    expect(result).toEqual({ ok: true });
  });

  it('allows a cancellation exactly two hours before the start', () => {
    now = new Date('2030-01-15T07:00:00Z');

    const result = validateCancellation({
      booking: confirmedBooking(),
      userId: OWNER_ID,
      now,
    });

    expect(result).toEqual({ ok: true });
  });

  it('refuses a cancellation one minute inside the window', () => {
    now = new Date('2030-01-15T07:01:00Z');

    const result = validateCancellation({
      booking: confirmedBooking(),
      userId: OWNER_ID,
      now,
    });

    expect(result).toEqual({ ok: false, code: 'CANCELLATION_WINDOW_CLOSED' });
  });

  it('refuses a cancellation by someone other than the owner', () => {
    const result = validateCancellation({
      booking: confirmedBooking(),
      userId: '11111111-1111-4111-8111-111111111102',
      now,
    });

    expect(result).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('refuses a booking that is already cancelled', () => {
    const result = validateCancellation({
      booking: { ...confirmedBooking(), status: 'CANCELLED' },
      userId: OWNER_ID,
      now,
    });

    expect(result).toEqual({ ok: false, code: 'BOOKING_ALREADY_CANCELLED' });
  });
});
