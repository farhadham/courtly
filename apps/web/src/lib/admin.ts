import type { Booking, Court } from '@courtly/contracts';
import { DEFAULT_FACILITY_TIME_ZONE } from './facility-time';

/**
 * Parses a euro amount typed by an admin into integer cents. Money never lives
 * as a float in the app, so the string is validated and converted with integer
 * arithmetic. A comma is accepted as the decimal separator. Anything that is
 * not a positive amount with at most two decimals returns `null`.
 */
export function parsePriceToCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim().replace(',', '.'));

  if (!match) {
    return null;
  }

  const euros = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const cents = euros * 100 + Number(fraction);

  return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
}

/** The inverse of {@link parsePriceToCents}, for prefilling the edit form. */
export function formatPriceInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface CourtDayGroup {
  courtId: string;
  courtName: string;
  timeZone: string;
  bookings: Booking[];
}

/**
 * Groups a day's bookings by court. Courts are sorted by name and each group's
 * bookings by start, so the operational view is stable between renders. A
 * booking whose court is missing from the list still appears, under a fallback
 * name, rather than being silently dropped.
 */
export function groupBookingsByCourt(bookings: Booking[], courts: Court[]): CourtDayGroup[] {
  const courtsById = new Map(courts.map((court) => [court.id, court]));
  const groups = new Map<string, CourtDayGroup>();

  for (const booking of bookings) {
    let group = groups.get(booking.courtId);

    if (!group) {
      const court = courtsById.get(booking.courtId);
      group = {
        courtId: booking.courtId,
        courtName: court?.name ?? 'Unknown court',
        timeZone: court?.timeZone ?? DEFAULT_FACILITY_TIME_ZONE,
        bookings: [],
      };
      groups.set(booking.courtId, group);
    }

    group.bookings.push(booking);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      bookings: [...group.bookings].sort((left, right) =>
        left.startAt.localeCompare(right.startAt),
      ),
    }))
    .sort((left, right) => left.courtName.localeCompare(right.courtName));
}
