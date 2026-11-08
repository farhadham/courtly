import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ShieldIcon } from 'lucide-react';
import { z } from 'zod';
import { CourtCard } from '@/components/court-card';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/feedback';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/error-messages';
import { useSession } from '@/lib/use-session';
import { courtsQueryOptions } from '@/queries/courts';

const courtSearchSchema = z.object({
  sport: z.string().min(1).optional(),
});

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { sport?: string } => {
    const parsed = courtSearchSchema.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
  component: CourtsPage,
});

function CourtsPage() {
  const session = useSession();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const courts = useQuery(courtsQueryOptions());
  const isAdmin = session?.user.role === 'ADMIN';

  /**
   * Chips come from the payload, never a hardcoded sport list, and are not
   * narrowed by the active filter so the other sports stay reachable.
   */
  const sports = useMemo(() => {
    const unique = new Set((courts.data ?? []).map((court) => court.sportType));
    return [...unique].sort((left, right) => left.localeCompare(right));
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Courts</h1>
        <p className="text-sm text-muted-foreground">
          Pick a court to see its availability. Times are shown in the facility time zone.
        </p>
      </header>

      {isAdmin ? (
        <Alert>
          <ShieldIcon aria-hidden="true" />
          <AlertTitle>Read-only admin view</AlertTitle>
          <AlertDescription>
            Admin tools for creating and editing courts arrive in a later phase. Booking actions are
            hidden for admin accounts.
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
          <div
            role="group"
            aria-label="Filter by sport"
            className="flex flex-wrap items-center gap-2"
          >
            <Button
              type="button"
              size="sm"
              variant={selectedSport ? 'outline' : 'default'}
              aria-pressed={!selectedSport}
              onClick={() => selectSport(undefined)}
            >
              All
            </Button>
            {sports.map((sport) => {
              const active = selectedSport?.toLowerCase() === sport.toLowerCase();

              return (
                <Button
                  key={sport}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  aria-pressed={active}
                  onClick={() => selectSport(active ? undefined : sport)}
                >
                  {sport}
                </Button>
              );
            })}
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
