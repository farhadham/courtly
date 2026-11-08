import { describe, expect, it } from 'vitest';
import type { Booking, Court } from '@courtly/contracts';
import { formatPriceInput, groupBookingsByCourt, parsePriceToCents } from './admin';

function booking(
  overrides: Partial<Booking> & Pick<Booking, 'id' | 'courtId' | 'startAt'>,
): Booking {
  return {
    userId: '00000000-0000-4000-8000-000000000001',
    endAt: overrides.startAt,
    durationHours: 1,
    priceCents: 1200,
    status: 'CONFIRMED',
    createdAt: '2030-01-01T00:00:00+00:00',
    ...overrides,
  };
}

function court(overrides: Partial<Court> & Pick<Court, 'id' | 'name'>): Court {
  return {
    sportType: 'padel',
    hourlyPriceCents: 1200,
    opensAt: '08:00',
    closesAt: '23:00',
    isActive: true,
    timeZone: 'Europe/Lisbon',
    ...overrides,
  };
}

describe('admin price input', () => {
  it('parses whole euros into cents', () => {
    expect(parsePriceToCents('12')).toBe(1200);
  });

  it('parses one or two decimals', () => {
    expect(parsePriceToCents('12.5')).toBe(1250);
    expect(parsePriceToCents('12.50')).toBe(1250);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parsePriceToCents('12,50')).toBe(1250);
  });

  it('rejects zero, negatives and more than two decimals', () => {
    expect(parsePriceToCents('0')).toBeNull();
    expect(parsePriceToCents('-3')).toBeNull();
    expect(parsePriceToCents('12.345')).toBeNull();
    expect(parsePriceToCents('1,000')).toBeNull();
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('abc')).toBeNull();
  });

  it('formats cents back into a two-decimal input value', () => {
    expect(formatPriceInput(1250)).toBe('12.50');
    expect(formatPriceInput(1200)).toBe('12.00');
  });
});

describe('grouping the admin day by court', () => {
  const north = court({ id: 'court-north', name: 'North' });
  const south = court({ id: 'court-south', name: 'South' });

  it('sorts groups by court name and bookings by start time', () => {
    const bookings = [
      booking({ id: 'b2', courtId: south.id, startAt: '2030-01-15T11:00:00+00:00' }),
      booking({ id: 'b1', courtId: north.id, startAt: '2030-01-15T10:00:00+00:00' }),
      booking({ id: 'b3', courtId: north.id, startAt: '2030-01-15T09:00:00+00:00' }),
    ];

    const groups = groupBookingsByCourt(bookings, [south, north]);

    expect(groups.map((group) => group.courtName)).toEqual(['North', 'South']);
    expect(groups[0]?.bookings.map((item) => item.id)).toEqual(['b3', 'b1']);
  });

  it('keeps cancelled bookings in the group', () => {
    const cancelled = booking({
      id: 'cancelled',
      courtId: north.id,
      startAt: '2030-01-15T09:00:00+00:00',
      status: 'CANCELLED',
    });

    const groups = groupBookingsByCourt([cancelled], [north]);

    expect(groups[0]?.bookings).toHaveLength(1);
    expect(groups[0]?.bookings[0]?.status).toBe('CANCELLED');
  });

  it('keeps a booking whose court is missing instead of dropping it', () => {
    const orphan = booking({
      id: 'orphan',
      courtId: 'court-missing',
      startAt: '2030-01-15T09:00:00+00:00',
    });

    const groups = groupBookingsByCourt([orphan], []);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.courtName).toBe('Unknown court');
    expect(groups[0]?.timeZone).toBe('Europe/Lisbon');
  });
});
