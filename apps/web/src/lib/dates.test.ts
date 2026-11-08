import { describe, expect, it } from 'vitest';
import { formatIsoDate, isIsoDate, parseIsoDate } from './dates';

describe('calendar dates', () => {
  it('parses a date to local midnight without a UTC shift', () => {
    const parsed = parseIsoDate('2030-01-15');

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2030);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(15);
    expect(formatIsoDate(parsed as Date)).toBe('2030-01-15');
  });

  it('rejects impossible calendar days', () => {
    expect(isIsoDate('2030-02-30')).toBe(false);
    expect(parseIsoDate('2030-02-30')).toBeNull();
  });

  it('rejects non-date strings', () => {
    expect(isIsoDate('15/01/2030')).toBe(false);
    expect(isIsoDate('2030-1-5')).toBe(false);
  });
});
