import { describe, expect, it } from 'vitest';
import type { AvailabilitySlot, AvailabilityStatus } from '@courtly/contracts';
import { canExtendSelection, selectionPriceCents, selectionWindow, toggleSelection } from './slots';

function slot(hour: number, status: AvailabilityStatus): AvailabilitySlot {
  return {
    startsAt: `2030-01-15T${String(hour).padStart(2, '0')}:00:00+00:00`,
    status,
  };
}

describe('slot selection', () => {
  const day = [
    slot(8, 'AVAILABLE'),
    slot(9, 'AVAILABLE'),
    slot(10, 'TAKEN'),
    slot(11, 'AVAILABLE'),
  ];

  it('selects one hour at the clicked slot', () => {
    expect(toggleSelection(day, null, 0)).toEqual({ startIndex: 0, durationHours: 1 });
  });

  it('extends to two hours when the next slot is free', () => {
    expect(toggleSelection(day, { startIndex: 0, durationHours: 1 }, 1)).toEqual({
      startIndex: 0,
      durationHours: 2,
    });
  });

  it('refuses to extend across a taken slot', () => {
    const selection = { startIndex: 2, durationHours: 1 } as const;

    // Index 2 is TAKEN, so it cannot be selected at all.
    expect(toggleSelection(day, selection, 2)).toBe(selection);
    expect(canExtendSelection(day, 2)).toBe(false);
  });

  it('leaves the selection alone when a non-available slot is clicked', () => {
    const selection = { startIndex: 0, durationHours: 1 } as const;

    expect(toggleSelection(day, selection, 2)).toBe(selection);
  });

  it('shrinks and clears a selection on repeat clicks', () => {
    expect(toggleSelection(day, { startIndex: 0, durationHours: 2 }, 1)).toEqual({
      startIndex: 0,
      durationHours: 1,
    });
    expect(toggleSelection(day, { startIndex: 0, durationHours: 2 }, 0)).toEqual({
      startIndex: 0,
      durationHours: 1,
    });
    expect(toggleSelection(day, { startIndex: 0, durationHours: 1 }, 0)).toBeNull();
  });

  it('starts a fresh one-hour selection elsewhere', () => {
    expect(toggleSelection(day, { startIndex: 0, durationHours: 2 }, 3)).toEqual({
      startIndex: 3,
      durationHours: 1,
    });
  });

  it('does not treat a non-consecutive free slot as adjacent', () => {
    const withGap = [slot(8, 'AVAILABLE'), slot(10, 'AVAILABLE')];

    expect(canExtendSelection(withGap, 0)).toBe(false);
    expect(toggleSelection(withGap, { startIndex: 0, durationHours: 1 }, 1)).toEqual({
      startIndex: 1,
      durationHours: 1,
    });
  });

  it('does not allow a two-hour run that would pass closing', () => {
    const closingDay = [slot(20, 'AVAILABLE'), slot(21, 'AVAILABLE')];

    expect(canExtendSelection(closingDay, 0)).toBe(true);
    expect(selectionWindow(closingDay, { startIndex: 0, durationHours: 2 })?.endAt).toEqual(
      new Date('2030-01-15T22:00:00+00:00'),
    );

    // The last slot has no next hour, so it cannot start a two-hour booking.
    expect(canExtendSelection(closingDay, 1)).toBe(false);
    expect(selectionWindow(closingDay, { startIndex: 1, durationHours: 2 })).toBeNull();
  });

  it('prices a selection by the court hourly rate', () => {
    expect(selectionPriceCents(2_000, { startIndex: 0, durationHours: 1 })).toBe(2_000);
    expect(selectionPriceCents(2_000, { startIndex: 0, durationHours: 2 })).toBe(4_000);
  });
});
