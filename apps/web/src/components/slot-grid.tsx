import type { AvailabilitySlot, AvailabilityStatus } from '@courtly/contracts';
import { CircleCheckIcon, ClockIcon, LockIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFacilityTime } from '@/lib/facility-time';
import type { SlotSelection } from '@/lib/slots';

const STATUS: Record<AvailabilityStatus, { label: string; icon: LucideIcon }> = {
  AVAILABLE: { label: 'Available', icon: CircleCheckIcon },
  TAKEN: { label: 'Taken', icon: LockIcon },
  PAST: { label: 'Past', icon: ClockIcon },
};

/**
 * One button per hourly slot. State is carried by the label, the icon and the
 * `aria-*` attributes, not by colour alone. A slot that cannot be booked stays
 * focusable (`aria-disabled`) so keyboard users can still read the day.
 */
export function SlotGrid({
  slots,
  timeZone,
  selection,
  onToggle,
  readOnly = false,
}: {
  slots: AvailabilitySlot[];
  timeZone: string;
  selection: SlotSelection | null;
  onToggle: (index: number) => void;
  readOnly?: boolean;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">No slots were returned for this day.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(STATUS) as AvailabilityStatus[]).map((status) => {
          const { label, icon: Icon } = STATUS[status];

          return (
            <li key={status} className="inline-flex items-center gap-1">
              <Icon aria-hidden="true" className="size-3" />
              {label}
            </li>
          );
        })}
        <li className="inline-flex items-center gap-1">
          <CircleCheckIcon aria-hidden="true" className="size-3" />
          Selected
        </li>
      </ul>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {slots.map((slot, index) => {
          const status = STATUS[slot.status];
          const selectable = slot.status === 'AVAILABLE' && !readOnly;
          const selected =
            selection !== null &&
            index >= selection.startIndex &&
            index < selection.startIndex + selection.durationHours;
          const label = selected ? 'Selected' : status.label;
          const Icon = selected ? CircleCheckIcon : status.icon;
          const time = formatFacilityTime(slot.startsAt, timeZone);

          return (
            <button
              key={slot.startsAt}
              type="button"
              aria-label={`${time}, ${label}`}
              aria-pressed={selectable ? selected : undefined}
              aria-disabled={selectable ? undefined : true}
              onClick={() => {
                if (selectable) {
                  onToggle(index);
                }
              }}
              className={cn(
                'flex min-h-16 flex-col items-start justify-center gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selectable && 'cursor-pointer hover:bg-accent',
                !selectable && 'cursor-default',
                slot.status === 'TAKEN' && 'bg-muted/60',
                slot.status === 'PAST' && 'bg-muted/30',
                selected && 'border-primary bg-primary/10 ring-2 ring-primary/30',
              )}
            >
              <span className="font-medium tabular-nums">{time}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs',
                  slot.status === 'AVAILABLE' && !selected
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-3" />
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
