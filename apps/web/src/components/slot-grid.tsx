import type { AvailabilitySlot, AvailabilityStatus } from '@courtly/contracts';
import { CircleCheckIcon, ClockIcon, LockIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFacilityTime } from '@/lib/facility-time';
import type { SlotSelection } from '@/lib/slots';

const STATUS: Record<AvailabilityStatus, { label: string; icon: LucideIcon; swatch: string }> = {
  AVAILABLE: {
    label: 'Available',
    icon: CircleCheckIcon,
    swatch: 'border-primary/30 bg-primary/10 text-primary',
  },
  TAKEN: {
    label: 'Taken',
    icon: LockIcon,
    swatch: 'border-border bg-muted text-muted-foreground',
  },
  PAST: {
    label: 'Past',
    icon: ClockIcon,
    swatch: 'border-dashed border-border bg-transparent text-muted-foreground',
  },
};

const SELECTED_SWATCH = 'border-primary bg-primary text-primary-foreground';

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
    return (
      <p className="rounded-xl border border-dashed bg-card/60 px-4 py-6 text-sm text-muted-foreground">
        No slots were returned for this day.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {(Object.keys(STATUS) as AvailabilityStatus[]).map((status) => {
          const { label, icon: Icon, swatch } = STATUS[status];

          return (
            <li key={status} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('grid size-4 place-items-center rounded-[5px] border', swatch)}
              >
                <Icon className="size-2.5" />
              </span>
              {label}
            </li>
          );
        })}
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn('grid size-4 place-items-center rounded-[5px] border', SELECTED_SWATCH)}
          >
            <CircleCheckIcon className="size-2.5" />
          </span>
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
                'group relative flex min-h-[4.5rem] flex-col justify-between gap-2 rounded-xl border p-3 text-left text-sm transition-all duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                selected
                  ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : slot.status === 'AVAILABLE'
                    ? 'border-border bg-card'
                    : slot.status === 'TAKEN'
                      ? 'border-border/70 bg-muted/60 text-muted-foreground'
                      : 'border-dashed border-border bg-muted/20 text-muted-foreground',
                selectable &&
                  !selected &&
                  'cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm',
                !selectable && 'cursor-default',
              )}
            >
              <span className="text-base font-semibold tabular-nums">{time}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[0.7rem] font-medium',
                  selected ? 'text-primary-foreground/80' : 'text-muted-foreground',
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
