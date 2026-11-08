import { useMutation, useQueryClient, queryOptions, type QueryClient } from '@tanstack/react-query';
import { bookingSchema } from '@courtly/contracts';
import type { BookingCreate, BookingScope } from '@courtly/contracts';
import { z } from 'zod';
import { fetchData } from '@/lib/api';

const bookingListSchema = z.array(bookingSchema);

export const myBookingsQueryOptions = (scope: BookingScope) =>
  queryOptions({
    queryKey: ['bookings', 'me', scope] as const,
    queryFn: () => fetchData(`/bookings/me?scope=${encodeURIComponent(scope)}`, bookingListSchema),
  });

/**
 * Creation and cancellation share invalidation: a booking changes the court's
 * availability and both sides of the owner's history, so no stale slot
 * survives the action.
 */
async function invalidateBookingViews(queryClient: QueryClient, courtId: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['availability', courtId] }),
    queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] }),
  ]);
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BookingCreate) =>
      fetchData('/bookings', bookingSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (booking) => {
      await invalidateBookingViews(queryClient, booking.courtId);
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) =>
      fetchData(`/bookings/${bookingId}/cancel`, bookingSchema, { method: 'POST' }),
    onSuccess: async (booking) => {
      await invalidateBookingViews(queryClient, booking.courtId);
    },
  });
}
