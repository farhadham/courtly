import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDaysIcon, ReceiptIcon, TrendingUpIcon } from 'lucide-react';
import { DatePicker } from '@/components/date-picker';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { SportIcon } from '@/components/sport-icon';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { groupBookingsByCourt } from '@/lib/admin';
import { errorMessage } from '@/lib/error-messages';
import { DEFAULT_FACILITY_TIME_ZONE, formatTimeRange, todayInFacility } from '@/lib/facility-time';
import { formatDuration, formatPrice } from '@/lib/format';
import { parseDateSearch } from '@/lib/search';
import { cn } from '@/lib/utils';
import { adminBookingsQueryOptions, adminCourtsQueryOptions } from '@/queries/admin';

export const Route = createFileRoute('/admin/')({
  validateSearch: parseDateSearch,
  component: AdminDayPage,
});

function AdminDayPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const date = search.date ?? todayInFacility(DEFAULT_FACILITY_TIME_ZONE);

  const bookings = useQuery(adminBookingsQueryOptions(date));
  // Court names and time zones live in the court list, and deactivated courts
  // still own bookings and revenue, so this list includes deactivated rows.
  const courts = useQuery(adminCourtsQueryOptions());

  const groups = useMemo(
    () => groupBookingsByCourt(bookings.data?.bookings ?? [], courts.data ?? []),
    [bookings.data, courts.data],
  );

  const courtsById = useMemo(
    () => new Map((courts.data ?? []).map((court) => [court.id, court])),
    [courts.data],
  );

  const isLoading = bookings.isPending || courts.isPending;
  const isError = bookings.isError || courts.isError;
  const error = bookings.error ?? courts.error;
  const isEmpty = bookings.isSuccess && courts.isSuccess && bookings.data.bookings.length === 0;

  const confirmedCount =
    bookings.data?.bookings.filter((booking) => booking.status === 'CONFIRMED').length ?? 0;
  const revenueCents = bookings.data?.totalRevenueCents ?? 0;
  const averageCents = confirmedCount > 0 ? Math.round(revenueCents / confirmedCount) : 0;
  const courtsWithBookings = new Set(
    (bookings.data?.bookings ?? [])
      .filter((booking) => booking.status === 'CONFIRMED')
      .map((booking) => booking.courtId),
  ).size;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin"
        title="Day view"
        description="Every booking for the selected day, grouped by court."
        actions={
          <DatePicker
            value={date}
            onChange={(nextDate) => void navigate({ search: { date: nextDate } })}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={ReceiptIcon}
          label="Day revenue"
          value={bookings.isSuccess ? formatPrice(revenueCents) : '—'}
          hint="Confirmed bookings only"
        />
        <StatCard
          icon={CalendarDaysIcon}
          label="Confirmed bookings"
          value={bookings.isSuccess ? String(confirmedCount) : '—'}
          hint={
            bookings.isSuccess
              ? `Across ${courtsWithBookings} ${courtsWithBookings === 1 ? 'court' : 'courts'}`
              : undefined
          }
        />
        <StatCard
          icon={TrendingUpIcon}
          label="Average booking"
          value={bookings.isSuccess ? formatPrice(averageCents) : '—'}
          hint="Per confirmed booking"
        />
      </div>

      {isLoading ? <ListSkeleton /> : null}

      {isError ? (
        <ErrorState
          title="Could not load the day"
          message={errorMessage(error)}
          onRetry={() => {
            void bookings.refetch();
            void courts.refetch();
          }}
        />
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="No bookings on this date"
          description="Nothing was booked for the selected day."
        />
      ) : null}

      {bookings.isSuccess && courts.isSuccess && groups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const court = courtsById.get(group.courtId);
            const groupRevenue = group.bookings
              .filter((booking) => booking.status === 'CONFIRMED')
              .reduce((total, booking) => total + booking.priceCents, 0);

            return (
              <Card key={group.courtId} className="gap-0 overflow-hidden py-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <SportIcon sportType={court?.sportType ?? ''} className="size-10 rounded-lg" />
                    <div className="flex flex-col gap-0.5">
                      <p className="font-semibold leading-tight">{group.courtName}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.bookings.length}{' '}
                        {group.bookings.length === 1 ? 'booking' : 'bookings'} &middot;{' '}
                        <span className="tabular-nums">{formatPrice(groupRevenue)}</span>
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {group.bookings.length}
                  </Badge>
                </div>
                <CardContent className="py-1">
                  <ul className="flex flex-col">
                    {group.bookings.map((booking) => {
                      const confirmed = booking.status === 'CONFIRMED';

                      return (
                        <li
                          key={booking.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 py-2.5 text-sm last:border-0 last:pb-0"
                        >
                          <span className="min-w-24 font-medium tabular-nums">
                            {formatTimeRange(booking.startAt, booking.endAt, group.timeZone)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(booking.durationHours)}
                          </span>
                          <Badge
                            variant={confirmed ? 'secondary' : 'outline'}
                            className={cn(
                              'gap-1.5',
                              confirmed ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
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
                          <span className="ml-auto text-sm font-medium tabular-nums">
                            {confirmed ? formatPrice(booking.priceCents) : '—'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
