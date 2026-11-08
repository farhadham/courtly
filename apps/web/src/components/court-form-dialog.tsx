import { useState } from 'react';
import type { FormEvent } from 'react';
import { courtCreateSchema } from '@courtly/contracts';
import type { Court } from '@courtly/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatPriceInput, parsePriceToCents } from '@/lib/admin';
import { errorMessage } from '@/lib/error-messages';
import { useCreateCourt, useUpdateCourt } from '@/queries/admin';

/**
 * Create and edit share one form. `court === null` means create; the caller
 * keys the form by court id so switching targets resets every field.
 */
export function CourtFormDialog({
  open,
  court,
  onOpenChange,
}: {
  open: boolean;
  court: Court | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <CourtForm key={court?.id ?? 'new'} court={court} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CourtForm({ court, onDone }: { court: Court | null; onDone: () => void }) {
  const createCourt = useCreateCourt();
  const updateCourt = useUpdateCourt();

  const [name, setName] = useState(court?.name ?? '');
  const [sportType, setSportType] = useState(court?.sportType ?? '');
  const [price, setPrice] = useState(court ? formatPriceInput(court.hourlyPriceCents) : '');
  const [opensAt, setOpensAt] = useState(court?.opensAt ?? '08:00');
  const [closesAt, setClosesAt] = useState(court?.closesAt ?? '23:00');
  const [formError, setFormError] = useState<string | null>(null);

  const pending = createCourt.isPending || updateCourt.isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedSport = sportType.trim();
    const cents = parsePriceToCents(price);
    const opens = opensAt.slice(0, 5);
    const closes = closesAt.slice(0, 5);

    if (!trimmedName) {
      setFormError('Enter a court name.');
      return;
    }

    if (trimmedSport.length < 1 || trimmedSport.length > 50) {
      setFormError('Enter a sport type of 1–50 characters.');
      return;
    }

    if (cents === null) {
      setFormError('Enter a positive hourly price, for example 20.00.');
      return;
    }

    if (opens >= closes) {
      setFormError('Closing time must be after opening time.');
      return;
    }

    const parsed = courtCreateSchema.safeParse({
      name: trimmedName,
      sportType: trimmedSport,
      hourlyPriceCents: cents,
      opensAt: opens,
      closesAt: closes,
    });

    if (!parsed.success) {
      setFormError('Check the court details and try again.');
      return;
    }

    setFormError(null);

    try {
      if (court) {
        await updateCourt.mutateAsync({ courtId: court.id, patch: parsed.data });
        toast.success('Court updated');
      } else {
        await createCourt.mutateAsync(parsed.data);
        toast.success('Court created');
      }

      onDone();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{court ? 'Edit court' : 'New court'}</DialogTitle>
        <DialogDescription>
          {court
            ? 'Changes apply to future bookings. Existing bookings keep their price snapshot.'
            : 'The court is active as soon as it is created.'}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="court-name">Name</FieldLabel>
          <Input
            id="court-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="court-sport">Sport type</FieldLabel>
            <Input
              id="court-sport"
              value={sportType}
              maxLength={50}
              onChange={(event) => setSportType(event.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="court-price">Hourly price (€)</FieldLabel>
            <Input
              id="court-price"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="court-opens">Opens at</FieldLabel>
            <Input
              id="court-opens"
              type="time"
              value={opensAt}
              onChange={(event) => setOpensAt(event.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="court-closes">Closes at</FieldLabel>
            <Input
              id="court-closes"
              type="time"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
              required
            />
          </Field>
        </div>
      </FieldGroup>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : court ? 'Save changes' : 'Create court'}
        </Button>
      </DialogFooter>
    </form>
  );
}
