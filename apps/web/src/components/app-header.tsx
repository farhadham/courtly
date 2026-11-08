import { Link, useRouter } from '@tanstack/react-router';
import { LogOutIcon, TrophyIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/query-client';
import { clearSession } from '@/lib/session';
import { useSession } from '@/lib/use-session';

const NAV_LINK =
  'rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground';
const ACTIVE_LINK = 'font-medium text-foreground';

export function AppHeader() {
  const session = useSession();
  const router = useRouter();

  if (!session) {
    return null;
  }

  const isAdmin = session.user.role === 'ADMIN';

  function signOut() {
    clearSession();
    queryClient.clear();
    void router.navigate({ to: '/login', search: {}, replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <TrophyIcon aria-hidden="true" className="size-5" />
          Courtly
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link to="/" className={NAV_LINK} activeProps={{ className: ACTIVE_LINK }}>
            Courts
          </Link>
          <Link to="/bookings" className={NAV_LINK} activeProps={{ className: ACTIVE_LINK }}>
            My bookings
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">
            {session.user.email}
          </span>
          {isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOutIcon data-icon="inline-start" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
