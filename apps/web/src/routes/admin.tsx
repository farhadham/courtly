import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { ShieldXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/lib/use-session';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

/**
 * The client-side half of the admin guard. The API independently rejects a
 * USER at `/admin`, so this only keeps the screens from rendering and firing
 * queries. A non-admin gets a forbidden state, never a redirect, matching the
 * `403` behaviour the web client already has.
 *
 * Navigation lives in the app header; adding a second admin nav here would
 * duplicate it on every admin screen.
 */
function AdminLayout() {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return <Forbidden />;
  }

  return <Outlet />;
}

function Forbidden() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <ShieldXIcon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Forbidden</h1>
        <p className="text-sm text-muted-foreground">
          This area is for administrators only. Sign in with an admin account to manage the
          facility.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Back to courts</Link>
      </Button>
    </div>
  );
}
