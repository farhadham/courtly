import { TrophyIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The square brand mark: a deep-green tile with a small highlight glint. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/10',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute -top-2.5 -right-2.5 size-6 rounded-full bg-highlight/40 blur-[1px]"
      />
      <TrophyIcon aria-hidden="true" className="relative size-[1.1rem]" />
    </span>
  );
}

/** Mark plus wordmark, used in the header and on the login brand panel. */
export function BrandLockup({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="text-base font-semibold tracking-tight">Courtly</span>
        {subtitle ? (
          <span className="mt-1 text-[0.68rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
