import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatIsoDate, parseIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * A calendar day, not an instant. The value is the facility's `YYYY-MM-DD`, so
 * it is parsed and formatted from its own parts and never shifted through the
 * viewer's zone.
 */
export function DatePicker({
  value,
  minDate,
  onChange,
}: {
  value: string;
  /** Omitted when any day is valid, as on the admin day view. */
  minDate?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value) ?? (minDate ? parseIsoDate(minDate) : null) ?? undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="justify-start bg-card tabular-nums"
          aria-label="Choose a date"
        >
          <CalendarIcon data-icon="inline-start" aria-hidden="true" className="text-primary" />
          {selected ? format(selected, 'd MMM yyyy') : 'Choose a date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          autoFocus
          disabled={(day) => (minDate ? formatIsoDate(day) < minDate : false)}
          onSelect={(day) => {
            if (!day) {
              return;
            }

            onChange(formatIsoDate(day));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The next few facility days as one-tap chips. `minDate` is the facility's
 * today, so the first chip means "today" regardless of the viewer's clock. The
 * calendar picker remains beside it for anything further out.
 */
export function DateQuickPicks({
  value,
  minDate,
  count = 4,
  onChange,
}: {
  value: string;
  minDate: string;
  count?: number;
  onChange: (value: string) => void;
}) {
  const first = parseIsoDate(minDate);

  if (!first) {
    return null;
  }

  const days = Array.from({ length: count }, (_, index) => addDays(first, index));

  return (
    <div role="group" aria-label="Quick dates" className="flex gap-2 overflow-x-auto pb-0.5">
      {days.map((day, index) => {
        const iso = formatIsoDate(day);
        const active = iso === value;
        const label = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : format(day, 'EEE');

        return (
          <button
            key={iso}
            type="button"
            aria-pressed={active}
            aria-label={`${label}, ${format(day, 'd MMMM yyyy')}`}
            onClick={() => onChange(iso)}
            className={cn(
              'flex min-w-[4.75rem] shrink-0 flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            <span className="text-xs font-medium">{label}</span>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                active ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {format(day, 'd MMM')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
