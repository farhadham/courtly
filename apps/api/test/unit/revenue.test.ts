import { describe, expect, it } from 'vitest';
import { sumRevenue } from '../../src/domain/revenue';

describe('sumRevenue', () => {
  it('returns zero for a day with no bookings', () => {
    expect(sumRevenue([])).toBe(0);
  });

  it('adds the snapshotted price of every confirmed booking', () => {
    expect(
      sumRevenue([
        { status: 'CONFIRMED', priceCents: 2_000 },
        { status: 'CONFIRMED', priceCents: 3_000 },
      ]),
    ).toBe(5_000);
  });

  it('excludes cancelled bookings even though their price is kept', () => {
    expect(
      sumRevenue([
        { status: 'CONFIRMED', priceCents: 2_000 },
        { status: 'CANCELLED', priceCents: 4_000 },
      ]),
    ).toBe(2_000);
  });

  it('returns zero for a day where every booking was cancelled', () => {
    expect(
      sumRevenue([
        { status: 'CANCELLED', priceCents: 2_000 },
        { status: 'CANCELLED', priceCents: 3_000 },
      ]),
    ).toBe(0);
  });
});
