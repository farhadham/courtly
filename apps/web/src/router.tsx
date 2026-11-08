import { createRouter } from '@tanstack/react-router';
import { setUnauthorizedHandler } from './lib/api';
import { queryClient } from './lib/query-client';
import { clearSession } from './lib/session';
import type { RouterContext } from './lib/router-context';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  context: { queryClient } satisfies RouterContext,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

/**
 * Any `UNAUTHORIZED` failure drops the in-memory and persisted session, clears
 * cached data that belonged to the old user, and returns to login with the
 * current route. A wrong password is `INVALID_CREDENTIALS`, not this: login
 * never redirects, because that failure is a form error.
 */
setUnauthorizedHandler(() => {
  const { location } = router.state;

  clearSession();
  queryClient.clear();

  if (location.pathname === '/login') {
    return;
  }

  void router.navigate({
    to: '/login',
    search: { redirect: location.href },
    replace: true,
  });
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
