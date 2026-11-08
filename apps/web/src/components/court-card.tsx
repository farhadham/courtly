import { Link } from '@tanstack/react-router';
import type { Court } from '@courtly/contracts';
import { ArrowRightIcon, ClockIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatPrice } from '@/lib/format';

/**
 * Opening hours are wall-clock times at the facility. They are rendered as the
 * API stores them and labelled with the court's zone, never converted to the
 * viewer's clock.
 */
export function CourtCard({ court }: { court: Court }) {
  return (
    <Link
      to="/courts/$courtId"
      params={{ courtId: court.id }}
      search={{ date: undefined }}
      className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:border-ring/60">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>{court.name}</CardTitle>
            <Badge variant="secondary">{court.sportType}</Badge>
          </div>
          <CardDescription>
            <span className="inline-flex items-center gap-1">
              <ClockIcon aria-hidden="true" className="size-3" />
              {court.opensAt}&ndash;{court.closesAt} ({court.timeZone})
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tracking-tight">
            {formatPrice(court.hourlyPriceCents)}
            <span className="text-sm font-normal text-muted-foreground"> / hour</span>
          </p>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 group-hover:text-foreground">
            View availability
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
