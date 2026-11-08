/**
 * One hour of elapsed time. Slot boundaries, booking durations and the
 * cancellation window are real hours, not wall-clock hours, so every domain
 * module measures them with this unit.
 */
export const HOUR_MS = 60 * 60 * 1000;
