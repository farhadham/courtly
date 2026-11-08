import { Link } from '@tanstack/react-router';
import type { Court } from '@courtly/contracts';
import { ArrowRightIcon, ClockIcon } from 'lucide-react';
import { SportIcon } from '@/components/sport-icon';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatPrice } from '@/lib/format';
import { sportStyle } from '@/lib/sports';
import { cn } from '@/lib/utils';

/**
 * Opening hours are wall-clock times at the facility. They are rendered as the
 * API stores them and labelled with the court's zone, never converted to the
 * viewer's clock.
 */
export function CourtCard({ court }: { court: Court }) {
  const { bar } = sportStyle(court.sportType);

  return (
    <Link
      to="/courts/$courtId"
      params={{ courtId: court.id }}
      search={{ date: undefined }}
      className="group block rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="relative h-full gap-0 overflow-hidden py-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md group-focus-visible:border-primary/30">
        <span aria-hidden="true" className={cn('h-1 w-full shrink-0', bar)} />

        <CardHeader className="px-5 pt-5">
          <div className="flex items-start gap-3">
            <SportIcon sportType={court.sportType} />
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="truncate text-lg">{court.name}</CardTitle>
              <CardDescription className="font-medium capitalize">
                {court.sportType}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-1 px-5 pt-5">
          <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Per hour
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatPrice(court.hourlyPriceCents)}
            <span className="text-sm font-normal text-muted-foreground"> / hour</span>
          </p>
        </CardContent>

        <CardFooter className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon aria-hidden="true" className="size-3.5" />
            {court.opensAt}&ndash;{court.closesAt} ({court.timeZone})
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            View times
            <ArrowRightIcon
              aria-hidden="true"
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
