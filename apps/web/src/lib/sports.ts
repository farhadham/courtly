import {
  CircleDotIcon,
  DumbbellIcon,
  FeatherIcon,
  GoalIcon,
  TargetIcon,
  TrophyIcon,
  VolleyballIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * A sport's icon and colour treatment. Sports come from the API as free text,
 * so unknown values fall back to a neutral trophy rather than breaking the
 * card. Classes are complete literals: Tailwind must see them to emit them.
 */
export interface SportStyle {
  icon: LucideIcon;
  tile: string;
  bar: string;
}

const STYLES: Record<string, SportStyle> = {
  tennis: {
    icon: VolleyballIcon,
    tile: 'bg-highlight/30 text-highlight-foreground',
    bar: 'bg-highlight',
  },
  padel: {
    icon: CircleDotIcon,
    tile: 'bg-primary/10 text-primary',
    bar: 'bg-primary',
  },
  badminton: {
    icon: FeatherIcon,
    tile: 'bg-sky-100 text-sky-700',
    bar: 'bg-sky-300',
  },
  squash: {
    icon: TargetIcon,
    tile: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-300',
  },
  football: {
    icon: GoalIcon,
    tile: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-300',
  },
  fitness: {
    icon: DumbbellIcon,
    tile: 'bg-rose-100 text-rose-700',
    bar: 'bg-rose-300',
  },
};

const FALLBACK: SportStyle = {
  icon: TrophyIcon,
  tile: 'bg-secondary text-secondary-foreground',
  bar: 'bg-border',
};

export function sportStyle(sportType: string): SportStyle {
  return STYLES[sportType.trim().toLowerCase()] ?? FALLBACK;
}
