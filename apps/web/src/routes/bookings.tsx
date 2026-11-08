import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Booking, BookingScope } from '@courtly/contracts';
import { z } from 'zod';
import { toast } from 'sonner';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isCancellationOpen } from '@/lib/cancellation';
import { CANCELLATION_CLOSED_MESSAGE, errorMessage } from '@/lib/error-messages';
import {
  DEFAULT_FACILITY_TIME_ZONE,
  formatFacilityDate,
  formatFacilityTime,
} from '@/lib/facility-time';
import { formatDuration, formatPrice } from '@/lib/format';
import { useSession } from '@/lib/use-session';
import { myBookingsQueryOptions, useCancelBooking } from '@/queries/bookings';
import { courtsQueryOptions } from '@/queries/courts';

const bookingsSearchSchema = z.object({
  scope: z.enum(['upcoming', 'past']).optional(),
});

export const Route = createFileRoute('/bookings')({
  validateSearch: (search: Record<string, unknown>): { scope?: BookingScope } => {
    const parsed = bookingsSearchSchema.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
  component: BookingsPage,
});

type CancellationOffer = 'none' | 'open' | 'closed';

/**
 * The single source for the cancel affordance: the button, the closed note, or
 * nothing at all. Both render branches read this result, so they cannot
 * disagree about a booking.
 */
function cancellationOfferFor(booking: Booking, now: Date, isAdmin: boolean): CancellationOffer {
  if (isAdmin || booking.status !== 'CONFIRMED') {
    return 'none';
  }

  return isCancellationOpen(booking.startAt, now) ? 'open' : 'closed';
}

function BookingsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const session = useSession();
  const isAdmin = session?.user.role === 'ADMIN';
  const scope: BookingScope = search.scope ?? 'upcoming';

  const bookings = useQuery(myBookingsQueryOptions(scope));
  const courts = useQuery(courtsQueryOptions());
  const cancelBooking = useCancelBooking();
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null);

  const courtsById = useMemo(
    () => new Map((courts.data ?? []).map((court) => [court.id, court])),
    [courts.data],
  );

  // The offer window is a UI hint; the API decides the actual cancellation.
  const now = new Date();

  function changeScope(next: string) {
    if (next === 'upcoming' || next === 'past') {
      void navigate({ search: { scope: next } });
    }
  }

  async function confirmCancellation() {
    if (!pendingCancel) {
      return;
    }

    try {
      await cancelBooking.mutateAsync(pendingCancel.id);
      setPendingCancel(null);
      toast.success('Booking cancelled');
    } catch (error) {
      setPendingCancel(null);

      // The window or the status may have changed since render; refresh so the
      // list reflects what the API just said.
      toast.error(errorMessage(error));
      await bookings.refetch();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My bookings</h1>
        <p className="text-sm text-muted-foreground">
          Times are shown in the court&rsquo;s facility time zone.
        </p>
      </header>

      <Tabs value={scope} onValueChange={changeScope}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>

      {bookings.isPending ? <ListSkeleton /> : null}

      {bookings.isError ? (
        <ErrorState
          title="Could not load your bookings"
          message={errorMessage(bookings.error)}
          onRetry={() => void bookings.refetch()}
        />
      ) : null}

      {bookings.isSuccess && bookings.data.length === 0 ? (
        <EmptyState
          title={scope === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
          description={
            scope === 'upcoming'
              ? 'Book a court and your booking will appear here.'
              : 'Completed and cancelled bookings appear here.'
          }
          action={
            scope === 'upcoming' ? (
              <Button asChild variant="outline">
                <Link to="/">Browse courts</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {bookings.isSuccess && bookings.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {bookings.data.map((booking) => {
            const court = courtsById.get(booking.courtId);
            const timeZone = court?.timeZone ?? DEFAULT_FACILITY_TIME_ZONE;
            const cancelling = cancelBooking.isPending && pendingCancel?.id === booking.id;
            const cancellationOffer = cancellationOfferFor(booking, now, isAdmin);

            return (
              <li key={booking.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{court?.name ?? 'Court'}</p>
                        <Badge variant={booking.status === 'CONFIRMED' ? 'secondary' : 'outline'}>
                          {booking.status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatFacilityDate(booking.startAt, timeZone)} &middot;{' '}
                        <span className="tabular-nums">
                          {formatFacilityTime(booking.startAt, timeZone)}&ndash;
                          {formatFacilityTime(booking.endAt, timeZone)}
                        </span>{' '}
                        &middot; {formatDuration(booking.durationHours)}
                      </p>
                      <p className="text-sm">{formatPrice(booking.priceCents)}</p>
                    </div>

                    {cancellationOffer === 'open' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingCancel(booking)}
                        disabled={cancelling}
                      >
                        Cancel booking
                      </Button>
                    ) : null}

                    {cancellationOffer === 'closed' ? (
                      <p className="max-w-56 text-xs text-muted-foreground">
                        {CANCELLATION_CLOSED_MESSAGE}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      <AlertDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCancel(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCancel
                ? `${courtsById.get(pendingCancel.courtId)?.name ?? 'This court'} on ${formatFacilityDate(
                    pendingCancel.startAt,
                    courtsById.get(pendingCancel.courtId)?.timeZone ?? DEFAULT_FACILITY_TIME_ZONE,
                  )} will be released for other users.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelBooking.isPending}
              onClick={(event) => {
                // The dialog closes on click; awaiting the mutation keeps the
                // toast and refetch tied to the outcome.
                event.preventDefault();
                void confirmCancellation();
              }}
            >
              {cancelBooking.isPending ? 'Cancelling…' : 'Cancel booking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
