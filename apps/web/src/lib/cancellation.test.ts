import { describe, expect, it } from 'vitest';
import { isCancellationOpen } from './cancellation';

describe('cancellation offer window', () => {
  const start = '2030-01-15T18:00:00+00:00';

  it('is open when more than two hours remain', () => {
    expect(isCancellationOpen(start, new Date('2030-01-15T15:00:00Z'))).toBe(true);
  });

  it('stays open at exactly two hours before the start', () => {
    expect(isCancellationOpen(start, new Date('2030-01-15T16:00:00Z'))).toBe(true);
  });

  it('closes one millisecond inside the two-hour window', () => {
    expect(isCancellationOpen(start, new Date('2030-01-15T16:00:00.001Z'))).toBe(false);
  });

  it('is closed once the booking has started', () => {
    expect(isCancellationOpen(start, new Date('2030-01-15T18:30:00Z'))).toBe(false);
  });
});
