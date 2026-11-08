import type { AvailabilitySlot, CourtRow } from '@courtly/contracts';

/**
 * The facility is in Lisbon. Court opening windows are local wall-clock times,
 * so every slot boundary is converted from that zone to a UTC instant here.
 */
export const FACILITY_TIME_ZONE = 'Europe/Lisbon';

const HOUR_MS = 60 * 60 * 1000;

export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

type Clock = Pick<CourtRow, 'opensAt' | 'closesAt'>;
type BookingInterval = { startAt: Date; endAt: Date };

const zonedPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: FACILITY_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function zonedParts(instant: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = zonedPartsFormatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/**
 * Offset of the facility zone from UTC at a given instant, in milliseconds.
 * Portugal observes WET/WEST, so this is 0 in winter and one hour in summer.
 */
function zoneOffsetMs(instant: Date): number {
  const parts = zonedParts(instant);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Turns a local wall-clock time in the facility zone into a UTC instant.
 * The offset is applied twice so a boundary that falls on a DST change still
 * resolves against the correct side of the transition.
 */
export function zonedTimeToUtc(date: LocalDate, hour: number, minute = 0): Date {
  const local = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const firstGuess = local - zoneOffsetMs(new Date(local));
  const corrected = local - zoneOffsetMs(new Date(firstGuess));

  return new Date(corrected);
}

/**
 * Parses `YYYY-MM-DD` and rejects dates that only look valid, such as
 * `2026-02-30`, which JavaScript would silently roll into March.
 */
export function localDateFromIso(value: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const probe = new Date(Date.UTC(date.year, date.month - 1, date.day));

  if (
    probe.getUTCFullYear() !== date.year ||
    probe.getUTCMonth() !== date.month - 1 ||
    probe.getUTCDate() !== date.day
  ) {
    return null;
  }

  return date;
}

function clockParts(value: string): { hour: number; minute: number } {
  return {
    hour: Number(value.slice(0, 2)),
    minute: Number(value.slice(3, 5)),
  };
}

/** The facility-local calendar day that contains an instant. */
export function localDateAt(instant: Date): LocalDate {
  const parts = zonedParts(instant);

  return { year: parts.year, month: parts.month, day: parts.day };
}

/** The local opening and closing instants of a court on a calendar day. */
export function courtOpeningWindow(
  court: Clock,
  date: LocalDate,
): { opensAt: Date; closesAt: Date } {
  const opens = clockParts(court.opensAt);
  const closes = clockParts(court.closesAt);

  return {
    opensAt: zonedTimeToUtc(date, opens.hour, opens.minute),
    closesAt: zonedTimeToUtc(date, closes.hour, closes.minute),
  };
}

/** Formats an instant in the `+00:00` ISO form the spec uses. */
export function formatInstant(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

function slotStatus(
  start: Date,
  end: Date,
  bookings: BookingInterval[],
  now: Date,
): AvailabilitySlot['status'] {
  // A slot that has already started can no longer be booked, whether or not
  // someone holds it.
  if (start.getTime() <= now.getTime()) {
    return 'PAST';
  }

  const taken = bookings.some(
    (booking) =>
      booking.startAt.getTime() < end.getTime() && booking.endAt.getTime() > start.getTime(),
  );

  return taken ? 'TAKEN' : 'AVAILABLE';
}

/**
 * Builds every one-hour slot between a court's opening and closing times for
 * one local day. A partial final hour is never emitted, so no slot starts
 * outside the opening window or ends after closing.
 */
export function availabilityForDay({
  court,
  date,
  bookings,
  now,
}: {
  court: Clock;
  date: LocalDate;
  bookings: BookingInterval[];
  now: Date;
}): AvailabilitySlot[] {
  const { opensAt: opens, closesAt: closes } = courtOpeningWindow(court, date);
  const slots: AvailabilitySlot[] = [];

  // Step through real hours from the opening instant instead of converting
  // each wall-clock hour separately: a Lisbon DST day either skips 01:00 or
  // repeats it, so wall-clock arithmetic would duplicate or drop a slot.
  let start = opens;

  while (start.getTime() + HOUR_MS <= closes.getTime()) {
    const end = new Date(start.getTime() + HOUR_MS);

    slots.push({
      startsAt: formatInstant(start),
      status: slotStatus(start, end, bookings, now),
    });

    start = end;
  }

  return slots;
}
