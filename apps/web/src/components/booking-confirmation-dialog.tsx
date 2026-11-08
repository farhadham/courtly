import { Link } from '@tanstack/react-router';
import type { Booking, Court } from '@courtly/contracts';
import { CheckIcon } from 'lucide-react';
import { SportIcon } from '@/components/sport-icon';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatFacilityDate, formatTimeRange } from '@/lib/facility-time';
import { formatDuration, formatPrice } from '@/lib/format';

/**
 * The booking confirmation is a dialog rather than a route: a deep-linkable
 * confirmation page is still out of scope, so the confirmation is tied to the
 * booking the user just created in this session.
 */
export function BookingConfirmationDialog({
  booking,
  court,
  onClose,
}: {
  booking: Booking | null;
  court: Court;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={booking !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="gap-5">
        {booking ? (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckIcon aria-hidden="true" className="size-5" />
              </span>
              <DialogHeader className="gap-1">
                <DialogTitle>Booking confirmed</DialogTitle>
                <DialogDescription>
                  {court.name} &middot; {formatFacilityDate(booking.startAt, court.timeZone)}
                </DialogDescription>
              </DialogHeader>
            </div>

            <dl className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                  <SportIcon
                    sportType={court.sportType}
                    className="size-8 rounded-lg"
                    iconClassName="size-4"
                  />
                  Court
                </dt>
                <dd className="font-medium">{court.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Time</dt>
                <dd className="font-medium tabular-nums">
                  {formatTimeRange(booking.startAt, booking.endAt, court.timeZone)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-medium">{formatDuration(booking.durationHours)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <dt className="font-medium">Total</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatPrice(booking.priceCents)}
                </dd>
              </div>
            </dl>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Done</Button>
              </DialogClose>
              <Button asChild onClick={onClose}>
                <Link to="/bookings" search={{ scope: 'upcoming' }}>
                  View my bookings
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
