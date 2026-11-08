import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { LogOutIcon } from 'lucide-react';
import { BrandLockup } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/query-client';
import { clearSession } from '@/lib/session';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';

/**
 * Colour lives in `data-[status=active]` variants rather than `activeProps`,
 * so the active pill cannot lose to the base colour because of stylesheet
 * order. Layout classes are the only thing shared by every state.
 */
const NAV_LINK =
  'rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-sm data-[status=active]:hover:bg-primary data-[status=active]:hover:text-primary-foreground';
const ACTIVE_LINK =
  'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground';

export function AppHeader() {
  const session = useSession();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!session) {
    return null;
  }

  const isAdmin = session.user.role === 'ADMIN';
  const initials = session.user.email.slice(0, 2).toUpperCase();
  // A link to `/` only marks itself active on the exact path; keep the section
  // highlighted while the user is looking at a court.
  const courtsActive = pathname === '/' || pathname.startsWith('/courts');

  function signOut() {
    clearSession();
    queryClient.clear();
    void router.navigate({ to: '/login', search: {}, replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          to="/"
          aria-label="Courtly home"
          className="order-1 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandLockup subtitle="Court booking" />
        </Link>

        <nav
          aria-label="Main"
          className="order-3 flex w-full flex-wrap items-center gap-1 text-sm sm:order-2 sm:w-auto"
        >
          <Link to="/" className={cn(NAV_LINK, courtsActive && ACTIVE_LINK)}>
            Courts
          </Link>
          <Link to="/bookings" className={NAV_LINK}>
            My bookings
          </Link>
          {isAdmin ? (
            <>
              <Link to="/admin" className={NAV_LINK} activeOptions={{ exact: true }}>
                Day view
              </Link>
              <Link to="/admin/courts" className={NAV_LINK}>
                Manage courts
              </Link>
            </>
          ) : null}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card py-1 pr-3 pl-1 shadow-xs sm:flex">
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-secondary text-[0.65rem] font-semibold tracking-wide text-secondary-foreground"
            >
              {initials}
            </span>
            <span className="max-w-40 truncate text-xs text-muted-foreground">
              {session.user.email}
            </span>
          </div>
          {isAdmin ? (
            <Badge className="border-0 bg-highlight text-highlight-foreground">Admin</Badge>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            aria-label="Sign out"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOutIcon data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
