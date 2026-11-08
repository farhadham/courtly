import { useMutation, useQueryClient, queryOptions, type QueryClient } from '@tanstack/react-query';
import { adminBookingsResponseSchema, courtListSchema, courtSchema } from '@courtly/contracts';
import type { CourtCreate, CourtUpdate } from '@courtly/contracts';
import { fetchData } from '@/lib/api';

/**
 * There is no `/admin/courts` read route: the admin court table is the public
 * list plus `includeInactive=true`, which the API only honours for an ADMIN.
 */
export const adminCourtsQueryOptions = () =>
  queryOptions({
    queryKey: ['courts', 'admin'] as const,
    queryFn: () => fetchData('/courts?includeInactive=true', courtListSchema),
  });

export const adminBookingsQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ['admin', 'bookings', date] as const,
    queryFn: () =>
      fetchData(`/admin/bookings?date=${encodeURIComponent(date)}`, adminBookingsResponseSchema),
  });

/**
 * A court change reaches every view that names or prices it: both court lists,
 * the court detail, its availability grid, and the admin day view.
 */
async function invalidateCourtViews(queryClient: QueryClient, courtId: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['courts'] }),
    queryClient.invalidateQueries({ queryKey: ['court', courtId] }),
    queryClient.invalidateQueries({ queryKey: ['availability', courtId] }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] }),
  ]);
}

export function useCreateCourt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CourtCreate) =>
      fetchData('/admin/courts', courtSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (court) => {
      await invalidateCourtViews(queryClient, court.id);
    },
  });
}

export function useUpdateCourt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ courtId, patch }: { courtId: string; patch: CourtUpdate }) =>
      fetchData(`/admin/courts/${courtId}`, courtSchema, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: async (court) => {
      await invalidateCourtViews(queryClient, court.id);
    },
  });
}
