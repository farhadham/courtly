/**
 * Court times are wall-clock times at the facility. Formatting an instant with
 * these helpers keeps a viewer's own timezone out of the picture: a 18:00 slot
 * in Lisbon reads 18:00 in Tokyo too, labelled as facility time.
 */

export function formatFacilityTime(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
}

export function formatFacilityDate(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(instant));
}

/**
 * The facility's current calendar date in `YYYY-MM-DD`, which is what the
 * availability endpoint expects. Deriving it from the viewer's local date can
 * be a day off when the viewer is in a different timezone.
 */
export function todayInFacility(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${read('year')}-${read('month')}-${read('day')}`;
}
