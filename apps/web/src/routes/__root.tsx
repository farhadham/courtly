import { createRootRouteWithContext, Link, Outlet, redirect } from '@tanstack/react-router';
import { AppHeader } from '@/components/app-header';
import { BrandMark } from '@/components/brand';
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
      <a
        href="#main-content"
        className="sr-only rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <AppHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
      >
        <Outlet />
      </main>
      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="inline-flex items-center gap-2">
            <BrandMark className="size-6 rounded-lg" />
            Courtly · Sports facility booking
          </p>
          <p>Times and prices are shown in the facility&rsquo;s time zone.</p>
        </div>
      </footer>
      <Toaster richColors position="top-center" />
      <Devtools />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">That address does not exist in this app.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to courts</Link>
      </Button>
    </div>
  );
}
