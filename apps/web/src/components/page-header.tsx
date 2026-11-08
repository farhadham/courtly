import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared page heading. The eyebrow is optional and gives admin/user screens a
 * little hierarchy without each route repeating the same stack of classes.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
