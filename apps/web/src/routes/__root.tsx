import { createRootRouteWithContext, Link, Outlet, redirect } from '@tanstack/react-router';
import { AppHeader } from '@/components/app-header';
import { Devtools } from '@/components/devtools';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { getSession } from '@/lib/session';
import type { RouterContext } from '@/lib/router-context';

/**
 * The auth guard for the whole SPA. Only `/login` is reachable signed out, and
 * the requested location travels with the redirect so login can send the user
 * back to it.
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ location }) => {
    if (!getSession() && location.pathname !== '/login') {
      // TanStack Router signals a redirect by throwing a control-flow object,
      // not an Error.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }
  },
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <Toaster richColors position="top-center" />
      <Devtools />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">That address does not exist in this app.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to courts</Link>
      </Button>
    </div>
  );
}
