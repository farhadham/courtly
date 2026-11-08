import { queryOptions } from '@tanstack/react-query';
import { courtListSchema, courtSchema } from '@courtly/contracts';
import { fetchData } from '@/lib/api';

/**
 * The court list is fetched unfiltered even when a sport chip is active: chips
 * are derived from this payload, so a filtered response would collapse the chip
 * row to the selected sport. The bookings list also needs every court to resolve
 * court names. Filtering a small single-facility list is cheap and keeps the
 * chips stable, so the API's `?sport=` filter is deliberately left unused and
 * the key carries no sport segment. See issue #9.
 */
export const courtsQueryOptions = () =>
  queryOptions({
    queryKey: ['courts'] as const,
    queryFn: () => fetchData('/courts', courtListSchema),
  });

export const courtQueryOptions = (courtId: string) =>
  queryOptions({
    queryKey: ['court', courtId] as const,
    queryFn: () => fetchData(`/courts/${courtId}`, courtSchema),
  });
