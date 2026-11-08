import { describe, expect, it } from 'vitest';
import type { AvailabilitySlot } from '@courtly/contracts';
import {
  availabilityForDay,
  localDateFromIso,
  localDayWindow,
} from '../../src/domain/availability';

const court = { opensAt: '00:00:00', closesAt: '05:00:00' };
const now = new Date('2026-01-01T00:00:00Z');

function startsAt(slots: AvailabilitySlot[]): string[] {
  return slots.map((slot) => slot.startsAt);
}

describe('availabilityForDay', () => {
  it('returns 15 slots for an 08:00-23:00 court on an ordinary day', () => {
    const slots = availabilityForDay({
      court: { opensAt: '08:00:00', closesAt: '23:00:00' },
      date: { year: 2030, month: 1, day: 15 },
      bookings: [],
      now,
    });

    expect(slots).toHaveLength(15);
    expect(slots[0]?.startsAt).toBe('2030-01-15T08:00:00+00:00');
    expect(slots.at(-1)?.startsAt).toBe('2030-01-15T22:00:00+00:00');
  });

  it('skips the nonexistent hour on the Lisbon spring-forward day', () => {
    // 2026-03-29: Lisbon jumps 01:00 WET -> 02:00 WEST, so the window
    // 00:00-05:00 contains four real hours, and 01:00 local never exists.
    const slots = availabilityForDay({
      court,
      date: { year: 2026, month: 3, day: 29 },
      bookings: [],
      now,
    });

    expect(startsAt(slots)).toEqual([
      '2026-03-29T00:00:00+00:00',
      '2026-03-29T01:00:00+00:00',
      '2026-03-29T02:00:00+00:00',
      '2026-03-29T03:00:00+00:00',
    ]);
  });

  it('keeps both occurrences of the repeated hour on the Lisbon fall-back day', () => {
    // 2026-10-25: Lisbon repeats 01:00 (02:00 WEST -> 01:00 WET), so the same
    // wall-clock window 00:00-05:00 contains six real hours.
    const slots = availabilityForDay({
      court,
      date: { year: 2026, month: 10, day: 25 },
      bookings: [],
      now,
    });

    expect(startsAt(slots)).toEqual([
      '2026-10-24T23:00:00+00:00',
      '2026-10-25T00:00:00+00:00',
      '2026-10-25T01:00:00+00:00',
      '2026-10-25T02:00:00+00:00',
      '2026-10-25T03:00:00+00:00',
      '2026-10-25T04:00:00+00:00',
    ]);
  });

  it('treats a booking as half-open so a back-to-back slot stays AVAILABLE', () => {
    const slots = availabilityForDay({
      court: { opensAt: '08:00:00', closesAt: '12:00:00' },
      date: { year: 2030, month: 1, day: 15 },
      bookings: [
        {
          startAt: new Date('2030-01-15T08:00:00Z'),
          endAt: new Date('2030-01-15T09:00:00Z'),
        },
      ],
      now,
    });

    // 08:00 is covered; 09:00 starts exactly when the booking ends.
    expect(slots.map((slot) => slot.status)).toEqual([
      'TAKEN',
      'AVAILABLE',
      'AVAILABLE',
      'AVAILABLE',
    ]);
  });

  it('marks a slot PAST when now is exactly its start', () => {
    const slots = availabilityForDay({
      court: { opensAt: '08:00:00', closesAt: '12:00:00' },
      date: { year: 2030, month: 1, day: 15 },
      bookings: [],
      now: new Date('2030-01-15T09:00:00Z'),
    });

    expect(slots.map((slot) => slot.status)).toEqual(['PAST', 'PAST', 'AVAILABLE', 'AVAILABLE']);
  });
});

describe('localDateFromIso', () => {
  it('accepts a leap day', () => {
    expect(localDateFromIso('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it('rejects a 29 February that is not in a leap year', () => {
    expect(localDateFromIso('2027-02-29')).toBeNull();
  });

  it('rejects an impossible calendar date', () => {
    expect(localDateFromIso('2026-02-30')).toBeNull();
  });

  it('rejects a zero-padding error', () => {
    expect(localDateFromIso('2026-1-5')).toBeNull();
  });
});

describe('localDayWindow', () => {
  it('spans 23 hours on the Lisbon spring-forward day', () => {
    // 2026-03-29: Lisbon jumps 01:00 WET -> 02:00 WEST.
    const { startsAt, endsAt } = localDayWindow({ year: 2026, month: 3, day: 29 });

    expect(startsAt.toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(endsAt.toISOString()).toBe('2026-03-29T23:00:00.000Z');
    expect(endsAt.getTime() - startsAt.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('spans 25 hours on the Lisbon fall-back day', () => {
    // 2026-10-25: Lisbon repeats 01:00 (02:00 WEST -> 01:00 WET).
    const { startsAt, endsAt } = localDayWindow({ year: 2026, month: 10, day: 25 });

    expect(startsAt.toISOString()).toBe('2026-10-24T23:00:00.000Z');
    expect(endsAt.toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(endsAt.getTime() - startsAt.getTime()).toBe(25 * 60 * 60 * 1000);
  });
});
