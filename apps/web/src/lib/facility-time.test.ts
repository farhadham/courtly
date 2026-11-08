import { describe, expect, it } from 'vitest';
import { formatFacilityDate, formatFacilityTime, todayInFacility } from './facility-time';

describe('facility time', () => {
  describe('formatFacilityTime', () => {
    it('shows a summer slot on the facility clock, not the viewer clock', () => {
      expect(formatFacilityTime('2030-07-15T17:00:00+00:00', 'Europe/Lisbon')).toBe('18:00');
    });

    it('shows a winter slot on the facility clock', () => {
      expect(formatFacilityTime('2030-01-15T18:00:00+00:00', 'Europe/Lisbon')).toBe('18:00');
    });
  });

  describe('todayInFacility', () => {
    it('uses the facility date when the viewer is already on the next day', () => {
      const instant = new Date('2030-01-15T23:30:00Z');

      expect(todayInFacility('Europe/Lisbon', instant)).toBe('2030-01-15');
      expect(todayInFacility('Asia/Tokyo', instant)).toBe('2030-01-16');
    });
  });

  describe('formatFacilityDate', () => {
    it('formats the calendar date in the facility zone', () => {
      expect(formatFacilityDate('2030-01-15T23:30:00Z', 'Europe/Lisbon')).toBe('15 Jan 2030');
    });
  });
});
