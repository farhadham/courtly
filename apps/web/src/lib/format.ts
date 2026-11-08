/** Money is stored in integer cents; the facility prices in euros. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/** Booking durations are whole hours, and only 1 is singular. */
export function formatDuration(hours: number): string {
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
