import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatIsoDate, parseIsoDate } from '@/lib/dates';

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
  minDate: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value) ?? parseIsoDate(minDate) ?? undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start" aria-label="Choose a date">
          <CalendarIcon data-icon="inline-start" aria-hidden="true" />
          {selected ? format(selected, 'd MMM yyyy') : 'Choose a date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          autoFocus
          disabled={(day) => formatIsoDate(day) < minDate}
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
