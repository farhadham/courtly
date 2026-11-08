import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { AvailabilitySlot, Booking } from '@courtly/contracts';
import { ArrowLeftIcon, ClockIcon, ShieldIcon } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { BookingConfirmationDialog } from '@/components/booking-confirmation-dialog';
import { DatePicker } from '@/components/date-picker';
import { ErrorState } from '@/components/feedback';
import { SlotGrid } from '@/components/slot-grid';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiRequestError } from '@/lib/api';
import { errorMessage, SLOT_TAKEN_MESSAGE } from '@/lib/error-messages';
import { formatFacilityTime, todayInFacility } from '@/lib/facility-time';
import { formatDuration, formatPrice } from '@/lib/format';
import { isIsoDate } from '@/lib/dates';
import { selectionPriceCents, selectionWindow, toggleSelection } from '@/lib/slots';
import type { SlotSelection } from '@/lib/slots';
import { useSession } from '@/lib/use-session';
import { availabilityQueryOptions } from '@/queries/availability';
import { useCreateBooking } from '@/queries/bookings';
import { courtQueryOptions } from '@/queries/courts';

const courtsSearchSchema = z.object({
  date: z.iso.date().optional(),
});

const NO_SLOTS: AvailabilitySlot[] = [];

export const Route = createFileRoute('/courts/$courtId')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => {
    const parsed = courtsSearchSchema.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
  component: CourtDetailPage,
});

function CourtDetailPage() {
  const { courtId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const session = useSession();
  const isAdmin = session?.user.role === 'ADMIN';

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
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 rounded-xl" />
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
  const selectionPrice = selection ? selectionPriceCents(court.hourlyPriceCents, selection) : 0;

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

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{court.name}</h1>
          <Badge variant="secondary">{court.sportType}</Badge>
        </div>
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Hourly price</dt>
            <dd>{formatPrice(court.hourlyPriceCents)} per hour</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="sr-only">Opening hours</dt>
            <dd className="inline-flex items-center gap-1">
              <ClockIcon aria-hidden="true" className="size-4" />
              {court.opensAt}&ndash;{court.closesAt} ({court.timeZone})
            </dd>
          </div>
        </dl>
      </header>

      {isAdmin ? (
        <Alert>
          <ShieldIcon aria-hidden="true" />
          <AlertTitle>Read-only admin view</AlertTitle>
          <AlertDescription>
            You can inspect availability, but booking is a user action and is hidden for admin
            accounts.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="availability-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="availability-heading" className="text-lg font-medium">
            Availability
          </h2>
          <DatePicker value={date} minDate={facilityToday} onChange={handleDateChange} />
        </div>

        {availabilityQuery.isPending ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
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
            readOnly={isAdmin}
            onToggle={handleToggle}
          />
        ) : null}
      </section>

      {!isAdmin ? (
        <section aria-label="Selected slot">
          {selection && windowRange ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{formatDuration(selection.durationHours)}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatFacilityTime(windowRange.startAt, court.timeZone)}&ndash;
                    {formatFacilityTime(windowRange.endAt, court.timeZone)} &middot;{' '}
                    {formatPrice(selectionPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setSelectionState(null)}>
                    Clear
                  </Button>
                  <Button onClick={() => void handleBook()} disabled={createBooking.isPending}>
                    {createBooking.isPending ? 'Booking…' : 'Book'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a start time. Pick the next free slot too for a two-hour booking.
            </p>
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
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      All courts
    </Link>
  );
}
