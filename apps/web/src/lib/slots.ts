import type { AvailabilitySlot } from '@courtly/contracts';
import { HOUR_MS } from './time';

/** A start slot plus how many consecutive hourly slots it covers. */
export interface SlotSelection {
  startIndex: number;
  durationHours: 1 | 2;
}

interface SelectionWindow {
  startAt: Date;
  endAt: Date;
}

function isAvailable(slot: AvailabilitySlot | undefined): slot is AvailabilitySlot {
  return slot?.status === 'AVAILABLE';
}

function isConsecutive(first: AvailabilitySlot, second: AvailabilitySlot): boolean {
  return new Date(second.startsAt).getTime() - new Date(first.startsAt).getTime() === HOUR_MS;
}

/**
 * A two-hour run needs the next hourly slot to exist and be free. The
 * availability payload never emits a slot that would end after closing, so a
 * present next slot also proves the run fits before closing.
 */
export function canExtendSelection(slots: AvailabilitySlot[], startIndex: number): boolean {
  const first = slots[startIndex];
  const second = slots[startIndex + 1];

  return isAvailable(first) && isAvailable(second) && isConsecutive(first, second);
}

/**
 * Turns a click on a slot into the next selection.
 *
 * - Nothing selected → one hour at the clicked slot.
 * - Clicking the start of a one-hour selection → clear it.
 * - Clicking the start of a two-hour selection → shrink to one hour.
 * - Clicking the hour after the start → extend to two hours, or shrink back.
 * - Clicking anywhere else → start a fresh one-hour selection.
 *
 * A non-available slot is ignored rather than clearing the selection.
 */
export function toggleSelection(
  slots: AvailabilitySlot[],
  selection: SlotSelection | null,
  index: number,
): SlotSelection | null {
  if (!isAvailable(slots[index])) {
    return selection;
  }

  if (!selection) {
    return { startIndex: index, durationHours: 1 };
  }

  if (index === selection.startIndex) {
    return selection.durationHours === 2 ? { startIndex: index, durationHours: 1 } : null;
  }

  if (index === selection.startIndex + 1) {
    if (selection.durationHours === 2) {
      return { startIndex: selection.startIndex, durationHours: 1 };
    }

    return canExtendSelection(slots, selection.startIndex)
      ? { startIndex: selection.startIndex, durationHours: 2 }
      : { startIndex: index, durationHours: 1 };
  }

  return { startIndex: index, durationHours: 1 };
}

/** The concrete range a selection covers, or `null` when the run is illegal. */
export function selectionWindow(
  slots: AvailabilitySlot[],
  selection: SlotSelection,
): SelectionWindow | null {
  const first = slots[selection.startIndex];

  if (!isAvailable(first)) {
    return null;
  }

  if (selection.durationHours === 2 && !canExtendSelection(slots, selection.startIndex)) {
    return null;
  }

  const startAt = new Date(first.startsAt);

  return {
    startAt,
    endAt: new Date(startAt.getTime() + selection.durationHours * HOUR_MS),
  };
}

export function selectionPriceCents(hourlyPriceCents: number, selection: SlotSelection): number {
  return hourlyPriceCents * selection.durationHours;
}
