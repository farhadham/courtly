import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { DatePicker } from '@/components/date-picker';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { groupBookingsByCourt } from '@/lib/admin';
import { errorMessage } from '@/lib/error-messages';
import {
  DEFAULT_FACILITY_TIME_ZONE,
  formatFacilityTime,
  todayInFacility,
} from '@/lib/facility-time';
import { formatDuration, formatPrice } from '@/lib/format';
import { adminBookingsQueryOptions, adminCourtsQueryOptions } from '@/queries/admin';

const adminDaySearchSchema = z.object({
  date: z.iso.date().optional(),
});

export const Route = createFileRoute('/admin/')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => {
    const parsed = adminDaySearchSchema.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
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

  const isLoading = bookings.isPending || courts.isPending;
  const isError = bookings.isError || courts.isError;
  const error = bookings.error ?? courts.error;
  const isEmpty = bookings.isSuccess && courts.isSuccess && bookings.data.bookings.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Day view</h1>
          <p className="text-sm text-muted-foreground">
            Every booking for the selected day, grouped by court.
          </p>
        </div>
        <DatePicker
          value={date}
          onChange={(nextDate) => void navigate({ search: { date: nextDate } })}
        />
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Day revenue</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {bookings.isSuccess ? formatPrice(bookings.data.totalRevenueCents) : '—'}
            </p>
          </div>
          <p className="max-w-64 text-xs text-muted-foreground">
            Sum of confirmed booking prices for the selected day. Cancelled bookings never count.
          </p>
        </CardContent>
      </Card>

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
          {groups.map((group) => (
            <Card key={group.courtId}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{group.courtName}</CardTitle>
                  <Badge variant="secondary">
                    {group.bookings.length} {group.bookings.length === 1 ? 'booking' : 'bookings'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {group.bookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <span className="tabular-nums">
                        {formatFacilityTime(booking.startAt, group.timeZone)}&ndash;
                        {formatFacilityTime(booking.endAt, group.timeZone)}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDuration(booking.durationHours)}
                      </span>
                      <Badge variant={booking.status === 'CONFIRMED' ? 'secondary' : 'outline'}>
                        {booking.status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}
                      </Badge>
                      {booking.status === 'CONFIRMED' ? (
                        <span className="tabular-nums">{formatPrice(booking.priceCents)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
