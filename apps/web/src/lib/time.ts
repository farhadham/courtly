/**
 * One hour of elapsed time. Slot boundaries and booking durations are real
 * hours, not wall-clock hours, and the availability API emits them the same
 * way, so slot math and the cancellation window share this unit.
 */
export const HOUR_MS = 60 * 60 * 1000;
