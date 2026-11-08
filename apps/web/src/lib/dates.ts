/**
 * Calendar days (`YYYY-MM-DD`) are not instants. Parsing one with `new Date()`
 * treats it as UTC and can shift the day for a viewer west of UTC, so these
 * helpers read and write the date parts directly.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight for a calendar day, or `null` when it is not a real date. */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(year, month - 1, day);
  const isRealDay =
    probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;

  return isRealDay ? probe : null;
}

/** Whether a string is a real calendar day (`YYYY-MM-DD`), not just that shape. */
export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

/** The local calendar day of a `Date`, as `YYYY-MM-DD`. */
export function formatIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
