import { queryOptions } from '@tanstack/react-query';
import { availabilityResponseSchema } from '@courtly/contracts';
import { fetchData } from '@/lib/api';

/**
 * `date` is a calendar day in the court's time zone, so it is passed through
 * untouched rather than derived from a viewer-local `Date`.
 */
export const availabilityQueryOptions = (courtId: string, date: string) =>
  queryOptions({
    queryKey: ['availability', courtId, date] as const,
    queryFn: () =>
      fetchData(
        `/courts/${courtId}/availability?date=${encodeURIComponent(date)}`,
        availabilityResponseSchema,
      ),
  });
