import { cn } from '@/lib/utils';
import { sportStyle } from '@/lib/sports';

/**
 * The icon tile used beside a court name. It carries the sport's tint but the
 * name and badge always sit next to it, so the tile is decoration only.
 */
export function SportIcon({
  sportType,
  className,
  iconClassName,
}: {
  sportType: string;
  className?: string;
  iconClassName?: string;
}) {
  const { icon: Icon, tile } = sportStyle(sportType);

  return (
    <span
      aria-hidden="true"
      className={cn('grid size-11 shrink-0 place-items-center rounded-xl', tile, className)}
    >
      <Icon className={cn('size-5', iconClassName)} />
    </span>
  );
}
