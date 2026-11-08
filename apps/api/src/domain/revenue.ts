import type { BookingStatus } from '@courtly/contracts';

/**
 * The fields revenue depends on: the snapshotted price and whether the booking
 * was cancelled. A cancelled row keeps its price but contributes nothing.
 */
interface PricedBooking {
  status: BookingStatus;
  priceCents: number;
}

/**
 * Day revenue (spec rule 8, ADR-0002): the sum of the snapshotted prices of
 * non-cancelled bookings. Reading the snapshot rather than the court's current
 * price keeps a past day a historical fact.
 */
export function sumRevenue(bookings: PricedBooking[]): number {
  return bookings
    .filter((booking) => booking.status !== 'CANCELLED')
    .reduce((total, booking) => total + booking.priceCents, 0);
}
