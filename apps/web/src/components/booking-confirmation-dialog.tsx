import { Link } from '@tanstack/react-router';
import type { Booking, Court } from '@courtly/contracts';
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
      <DialogContent>
        {booking ? (
          <>
            <DialogHeader>
              <DialogTitle>Booking confirmed</DialogTitle>
              <DialogDescription>
                {court.name} &middot; {formatFacilityDate(booking.startAt, court.timeZone)}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Court</dt>
              <dd className="font-medium">{court.name}</dd>
              <dt className="text-muted-foreground">Time</dt>
              <dd className="font-medium tabular-nums">
                {formatTimeRange(booking.startAt, booking.endAt, court.timeZone)}
              </dd>
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="font-medium">{formatDuration(booking.durationHours)}</dd>
              <dt className="text-muted-foreground">Price</dt>
              <dd className="font-medium">{formatPrice(booking.priceCents)}</dd>
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
