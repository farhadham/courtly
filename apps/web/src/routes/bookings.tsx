import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Booking, BookingScope } from '@courtly/contracts';
import { CalendarDaysIcon, ClockIcon, HistoryIcon, InfoIcon } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { SportIcon } from '@/components/sport-icon';
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
  formatTimeRange,
} from '@/lib/facility-time';
import { formatDuration, formatPrice } from '@/lib/format';
import { useIsAdmin } from '@/lib/use-session';
import { cn } from '@/lib/utils';
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
  const isAdmin = useIsAdmin();
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
      <PageHeader
        eyebrow="Your schedule"
        title="My bookings"
        description="Upcoming and past reservations, shown in the court's facility time zone."
      />

      <Tabs value={scope} onValueChange={changeScope}>
        <TabsList className="bg-secondary/80 p-1">
          <TabsTrigger value="upcoming">
            <CalendarDaysIcon aria-hidden="true" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past">
            <HistoryIcon aria-hidden="true" />
            Past
          </TabsTrigger>
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
            const confirmed = booking.status === 'CONFIRMED';

            return (
              <li key={booking.id}>
                <Card
                  className={cn(
                    'overflow-hidden transition-colors',
                    !confirmed && 'border-border/70 bg-muted/30',
                  )}
                >
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <SportIcon
                        sportType={court?.sportType ?? ''}
                        className={cn(!confirmed && 'opacity-70 grayscale')}
                      />
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{court?.name ?? 'Court'}</p>
                          <Badge
                            variant={confirmed ? 'secondary' : 'outline'}
                            className={cn(
                              'gap-1.5',
                              confirmed && 'bg-primary/10 text-primary',
                              !confirmed && 'text-muted-foreground',
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                'size-1.5 rounded-full',
                                confirmed ? 'bg-primary' : 'bg-muted-foreground',
                              )}
                            />
                            {confirmed ? 'Confirmed' : 'Cancelled'}
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDaysIcon aria-hidden="true" className="size-3.5" />
                            {formatFacilityDate(booking.startAt, timeZone)}
                          </span>
                          <span aria-hidden="true" className="hidden sm:inline">
                            &middot;
                          </span>
                          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <ClockIcon aria-hidden="true" className="size-3.5" />
                              {formatTimeRange(booking.startAt, booking.endAt, timeZone)}
                            </span>
                            <span aria-hidden="true" className="text-border">
                              &middot;
                            </span>
                            <span>{formatDuration(booking.durationHours)}</span>
                          </span>
                        </div>

                        <p className="text-sm font-semibold tabular-nums">
                          {formatPrice(booking.priceCents)}
                        </p>
                      </div>
                    </div>

                    {cancellationOffer === 'open' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingCancel(booking)}
                        disabled={cancelling}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Cancel booking
                      </Button>
                    ) : null}

                    {cancellationOffer === 'closed' ? (
                      <p className="flex max-w-60 items-start gap-1.5 text-xs text-muted-foreground">
                        <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
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
