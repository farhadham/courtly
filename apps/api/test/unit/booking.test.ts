import { describe, expect, it } from 'vitest';
import { validateBooking } from '../../src/domain/booking';

// January in Lisbon is UTC+0, so a UTC instant is also the facility's wall clock.
const now = new Date('2030-01-15T06:00:00Z');

const court = {
  opensAt: '08:00:00',
  closesAt: '23:00:00',
  isActive: true,
  hourlyPriceCents: 2_000,
};

describe('validateBooking', () => {
  it('rejects a start at the current instant', () => {
    const result = validateBooking({
      court,
      startAt: new Date('2030-01-15T06:00:00Z'),
      durationHours: 1,
      now,
    });

    expect(result).toEqual({ ok: false, code: 'BOOKING_IN_PAST' });
  });

  it('rejects a start before the court opens', () => {
    const result = validateBooking({
      court,
      startAt: new Date('2030-01-15T07:00:00Z'),
      durationHours: 1,
      now,
    });

    expect(result).toEqual({ ok: false, code: 'OUTSIDE_OPENING_HOURS' });
  });

  it('rejects a two-hour booking that ends after the court closes', () => {
    const result = validateBooking({
      court,
      startAt: new Date('2030-01-15T22:00:00Z'),
      durationHours: 2,
      now,
    });

    expect(result).toEqual({ ok: false, code: 'OUTSIDE_OPENING_HOURS' });
  });

  it('rejects a booking on a deactivated court', () => {
    const result = validateBooking({
      court: { ...court, isActive: false },
      startAt: new Date('2030-01-15T09:00:00Z'),
      durationHours: 1,
      now,
    });

    expect(result).toEqual({ ok: false, code: 'COURT_INACTIVE' });
  });

  it('accepts a legal booking and snapshots the price for its duration', () => {
    const startAt = new Date('2030-01-15T09:00:00Z');

    const result = validateBooking({ court, startAt, durationHours: 2, now });

    expect(result).toEqual({
      ok: true,
      startAt,
      endAt: new Date('2030-01-15T11:00:00Z'),
      durationHours: 2,
      priceCents: 4_000,
    });
  });

  it('reads the opening window on the facility clock during summer time', () => {
    // 08:00 in Lisbon during WEST is 07:00 UTC; opening exactly then is legal.
    const result = validateBooking({
      court,
      startAt: new Date('2030-07-15T07:00:00Z'),
      durationHours: 1,
      now: new Date('2030-07-15T06:00:00Z'),
    });

    expect(result).toMatchObject({ ok: true });
  });
});
