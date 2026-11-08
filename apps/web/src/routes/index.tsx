import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Clock3Icon, ShieldCheckIcon, ShieldIcon, SparklesIcon } from 'lucide-react';
import { z } from 'zod';
import { CourtCard } from '@/components/court-card';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/feedback';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/error-messages';
import { useIsAdmin } from '@/lib/use-session';
import { courtsQueryOptions } from '@/queries/courts';

const courtSearchSchema = z.object({
  sport: z.string().min(1).optional(),
});

const HERO_FACTS = [
  { icon: Clock3Icon, text: '1-hour slots' },
  { icon: ShieldCheckIcon, text: 'No double bookings' },
  { icon: SparklesIcon, text: 'Cancel up to 2 h before' },
];

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { sport?: string } => {
    const parsed = courtSearchSchema.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
  component: CourtsPage,
});

function CourtsPage() {
  const isAdmin = useIsAdmin();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const courts = useQuery(courtsQueryOptions());

  /**
   * Chips come from the payload, never a hardcoded sport list, and are not
   * narrowed by the active filter so the other sports stay reachable.
   */
  const sports = useMemo(() => {
    const counts = new Map<string, number>();

    for (const court of courts.data ?? []) {
      const key = court.sportType;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [courts.data]);

  const selectedSport = search.sport;
  const visible = useMemo(() => {
    const all = courts.data ?? [];

    if (!selectedSport) {
      return all;
    }

    return all.filter((court) => court.sportType.toLowerCase() === selectedSport.toLowerCase());
  }, [courts.data, selectedSport]);

  function selectSport(sport: string | undefined) {
    void navigate({ search: { sport } });
  }

  const totalCourts = courts.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
        <div aria-hidden="true" className="court-lines absolute inset-0 opacity-60" />
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-16 size-72 rounded-full bg-highlight/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-primary-foreground/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-7 px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-highlight uppercase">
              Court booking
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Find your court. Book your hour.
            </h1>
            <p className="max-w-xl text-sm/relaxed text-primary-foreground/75 sm:text-base">
              Browse hourly availability across the facility, pick one or two hours, and get back to
              the game.
            </p>
          </div>

          <ul className="flex flex-wrap gap-2 text-xs font-medium">
            {HERO_FACTS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-1.5 text-primary-foreground/85"
              >
                <Icon aria-hidden="true" className="size-3.5 text-highlight" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {isAdmin ? (
        <Alert className="border-primary/20 bg-primary/5">
          <ShieldIcon aria-hidden="true" />
          <AlertTitle>Admin view</AlertTitle>
          <AlertDescription>
            Manage courts and review the day&rsquo;s bookings from the admin screens. Booking
            actions are hidden for admin accounts.
          </AlertDescription>
        </Alert>
      ) : null}

      {courts.isPending ? <CardGridSkeleton /> : null}

      {courts.isError ? (
        <ErrorState
          title="Could not load courts"
          message={errorMessage(courts.error)}
          onRetry={() => void courts.refetch()}
        />
      ) : null}

      {courts.isSuccess && courts.data.length === 0 ? (
        <EmptyState
          title="No courts yet"
          description="There are no active courts at this facility right now."
        />
      ) : null}

      {courts.isSuccess && courts.data.length > 0 ? (
        <>
          <div className="flex flex-col gap-3">
            <div
              role="group"
              aria-label="Filter by sport"
              className="flex flex-wrap items-center gap-2"
            >
              <span className="mr-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Filter
              </span>
              <SportChip
                label="All"
                count={totalCourts}
                active={!selectedSport}
                onClick={() => selectSport(undefined)}
              />
              {sports.map(([sport, count]) => {
                const active = selectedSport?.toLowerCase() === sport.toLowerCase();

                return (
                  <SportChip
                    key={sport}
                    label={sport}
                    count={count}
                    active={active}
                    onClick={() => selectSport(active ? undefined : sport)}
                  />
                );
              })}
            </div>

            <p className="text-sm text-muted-foreground">
              {selectedSport
                ? `${visible.length} ${selectedSport} ${visible.length === 1 ? 'court' : 'courts'} out of ${totalCourts}`
                : `${totalCourts} ${totalCourts === 1 ? 'court' : 'courts'} ready to book`}
            </p>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title={`No ${selectedSport} courts`}
              description="No active court matches this sport filter."
              action={
                <Button variant="outline" onClick={() => selectSport(undefined)}>
                  Clear filter
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((court) => (
                <CourtCard key={court.id} court={court} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function SportChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums',
          active
            ? 'bg-primary-foreground/15 text-primary-foreground'
            : 'bg-muted text-foreground/70',
        )}
      >
        {count}
      </span>
    </button>
  );
}
