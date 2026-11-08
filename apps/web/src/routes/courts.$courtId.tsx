import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { AvailabilitySlot, Booking } from '@courtly/contracts';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  MousePointerClickIcon,
  ShieldIcon,
  ShieldXIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { BookingConfirmationDialog } from '@/components/booking-confirmation-dialog';
import { DatePicker, DateQuickPicks } from '@/components/date-picker';
import { ErrorState } from '@/components/feedback';
import { SportIcon } from '@/components/sport-icon';
import { SlotGrid } from '@/components/slot-grid';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiRequestError } from '@/lib/api';
import { errorMessage, SLOT_TAKEN_MESSAGE } from '@/lib/error-messages';
import { formatTimeRange, todayInFacility } from '@/lib/facility-time';
import { formatDuration, formatPrice } from '@/lib/format';
import { isIsoDate, parseIsoDate } from '@/lib/dates';
import { parseDateSearch } from '@/lib/search';
import { selectionPriceCents, selectionWindow, toggleSelection } from '@/lib/slots';
import type { SlotSelection } from '@/lib/slots';
import { sportStyle } from '@/lib/sports';
import { useIsAdmin } from '@/lib/use-session';
import { cn } from '@/lib/utils';
import { availabilityQueryOptions } from '@/queries/availability';
import { useCreateBooking } from '@/queries/bookings';
import { courtQueryOptions } from '@/queries/courts';

const NO_SLOTS: AvailabilitySlot[] = [];

export const Route = createFileRoute('/courts/$courtId')({
  validateSearch: parseDateSearch,
  component: CourtDetailPage,
});

function CourtDetailPage() {
  const { courtId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const isAdmin = useIsAdmin();

  const courtQuery = useQuery(courtQueryOptions(courtId));
  const courtData = courtQuery.data;

  const facilityToday = courtData ? todayInFacility(courtData.timeZone) : '';
  const suppliedDate = search.date && isIsoDate(search.date) ? search.date : null;
  const date = suppliedDate ?? facilityToday;

  const availabilityQuery = useQuery({
    ...availabilityQueryOptions(courtId, date),
    enabled: courtData !== undefined,
  });
  const slots = availabilityQuery.data ?? NO_SLOTS;

  /**
   * The selection remembers which day it belongs to. A selection from another
   * day, or one whose slots stopped being bookable after a refetch, simply is
   * not rendered — no effect has to clear it.
   */
  const [selectionState, setSelectionState] = useState<{
    date: string;
    value: SlotSelection;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);
  const createBooking = useCreateBooking();

  /**
   * Resolved once per render: the same `windowRange` drives the summary card,
   * the submit and the slot grid, so they cannot disagree.
   */
  const candidate = selectionState && selectionState.date === date ? selectionState.value : null;
  const windowRange = candidate ? selectionWindow(slots, candidate) : null;
  const selection = windowRange ? candidate : null;

  if (courtQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading court">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (courtQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <ErrorState
          title="Could not load this court"
          message={errorMessage(courtQuery.error)}
          onRetry={() => void courtQuery.refetch()}
        />
      </div>
    );
  }

  const court = courtQuery.data;
  const readOnly = isAdmin || !court.isActive;
  const selectionPrice = selection ? selectionPriceCents(court.hourlyPriceCents, selection) : 0;
  const { bar } = sportStyle(court.sportType);
  const parsedDate = parseIsoDate(date);
  const dateLabel = parsedDate ? format(parsedDate, 'EEEE d MMMM') : date;
  const availableCount = slots.filter((slot) => slot.status === 'AVAILABLE').length;

  function handleDateChange(nextDate: string) {
    void navigate({ search: (previous) => ({ ...previous, date: nextDate }) });
  }

  function handleToggle(index: number) {
    const next = toggleSelection(slots, selection, index);
    setSelectionState(next ? { date, value: next } : null);
  }

  async function handleBook() {
    if (!selection || !windowRange) {
      return;
    }

    try {
      const created = await createBooking.mutateAsync({
        courtId: court.id,
        startAt: windowRange.startAt,
        durationHours: selection.durationHours,
      });

      setSelectionState(null);
      setConfirmation(created);
      toast.success('Booking confirmed');
    } catch (error) {
      if (isApiRequestError(error) && error.code === 'SLOT_TAKEN') {
        // The slot was booked between render and submit. Say so and refresh
        // rather than removing the slot optimistically.
        toast.error(SLOT_TAKEN_MESSAGE);
        setSelectionState(null);
        await availabilityQuery.refetch();
        return;
      }

      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', bar)} />
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <SportIcon
              sportType={court.sportType}
              className="size-14 rounded-2xl"
              iconClassName="size-6"
            />
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                  {court.name}
                </h1>
                <Badge variant="secondary" className="capitalize">
                  {court.sportType}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Hourly booking at the facility. Pick a day, then one or two consecutive hours.
              </p>
            </div>
          </div>

          <dl className="flex flex-wrap gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5">
              <dt className="sr-only">Hourly price</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {formatPrice(court.hourlyPriceCents)}
              </dd>
              <span className="text-muted-foreground">per hour</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-muted-foreground">
              <dt className="sr-only">Opening hours</dt>
              <dd className="inline-flex items-center gap-1.5">
                <ClockIcon aria-hidden="true" className="size-3.5 text-primary" />
                {court.opensAt}&ndash;{court.closesAt}
              </dd>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-muted-foreground">
              <dt className="sr-only">Facility time zone</dt>
              <dd className="inline-flex items-center gap-1.5">
                <MapPinIcon aria-hidden="true" className="size-3.5 text-primary" />
                {court.timeZone}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {!court.isActive ? (
        <Alert className="border-border bg-muted/40">
          <ShieldXIcon aria-hidden="true" />
          <AlertTitle>Court deactivated</AlertTitle>
          <AlertDescription>
            This court is not accepting new bookings. Existing bookings are unchanged.
          </AlertDescription>
        </Alert>
      ) : isAdmin ? (
        <Alert className="border-primary/20 bg-primary/5">
          <ShieldIcon aria-hidden="true" />
          <AlertTitle>Read-only admin view</AlertTitle>
          <AlertDescription>
            You can inspect availability, but booking is a user action and is hidden for admin
            accounts.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="availability-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="availability-heading" className="text-lg font-semibold tracking-tight">
                Availability
              </h2>
              <p className="text-sm text-muted-foreground">
                {dateLabel}
                {availabilityQuery.isSuccess && court.isActive ? (
                  <>
                    {' '}
                    &middot; {availableCount} {availableCount === 1 ? 'slot' : 'slots'} free
                  </>
                ) : null}
              </p>
            </div>
            <DatePicker value={date} minDate={facilityToday} onChange={handleDateChange} />
          </div>

          <DateQuickPicks
            value={date}
            minDate={facilityToday}
            count={4}
            onChange={handleDateChange}
          />
        </div>

        {availabilityQuery.isPending ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="h-[4.5rem] rounded-xl" />
            ))}
          </div>
        ) : null}

        {availabilityQuery.isError ? (
          <ErrorState
            title="Could not load availability"
            message={errorMessage(availabilityQuery.error)}
            onRetry={() => void availabilityQuery.refetch()}
          />
        ) : null}

        {availabilityQuery.isSuccess ? (
          <SlotGrid
            slots={slots}
            timeZone={court.timeZone}
            selection={selection}
            readOnly={readOnly}
            onToggle={handleToggle}
          />
        ) : null}
      </section>

      {!readOnly ? (
        <section aria-label="Selected slot">
          {selection && windowRange ? (
            <Card className="sticky bottom-4 z-20 gap-0 border-primary/20 bg-card/95 py-0 shadow-lg shadow-primary/10 backdrop-blur">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-highlight/30 text-highlight-foreground">
                    <CalendarDaysIcon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold">
                      {formatDuration(selection.durationHours)} &middot;{' '}
                      <span className="tabular-nums">
                        {formatTimeRange(windowRange.startAt, windowRange.endAt, court.timeZone)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatPrice(selectionPrice)}
                      </span>{' '}
                      &middot; free cancellation up to 2 hours before
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectionState(null)}>
                    <XIcon aria-hidden="true" />
                    Clear
                  </Button>
                  <Button onClick={() => void handleBook()} disabled={createBooking.isPending}>
                    {createBooking.isPending
                      ? 'Booking…'
                      : `Book for ${formatPrice(selectionPrice)}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-4 py-4 text-sm text-muted-foreground">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <MousePointerClickIcon aria-hidden="true" className="size-4" />
              </span>
              <p>Select a start time. Pick the next free slot too for a two-hour booking.</p>
            </div>
          )}
        </section>
      ) : null}

      <BookingConfirmationDialog
        booking={confirmation}
        court={court}
        onClose={() => setConfirmation(null)}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex w-fit items-center gap-1.5 rounded-full text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      All courts
    </Link>
  );
}
