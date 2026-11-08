import { HOUR_MS } from './time';

/** Cancellation closes two hours before the start; exactly two hours is open. */
export const CANCELLATION_WINDOW_MS = 2 * HOUR_MS;

/**
 * Whether the cancel action may still be offered. The API remains the
 * authority; this only decides whether the button exists.
 */
export function isCancellationOpen(startAt: Date | string, now: Date): boolean {
  return now.getTime() <= new Date(startAt).getTime() - CANCELLATION_WINDOW_MS;
}
