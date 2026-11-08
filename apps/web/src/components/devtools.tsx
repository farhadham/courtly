import { lazy, Suspense } from 'react';

/**
 * Devtools are lazy and only imported when Vite reports a development build,
 * so the production bundle never contains them.
 */
const RouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const mod = await import('@tanstack/react-router-devtools');
      return { default: mod.TanStackRouterDevtools };
    })
  : null;

const QueryDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const mod = await import('@tanstack/react-query-devtools');
      return {
        default: function QueryDevtoolsPanel() {
          return <mod.ReactQueryDevtools initialIsOpen={false} />;
        },
      };
    })
  : null;

export function Devtools() {
  if (!RouterDevtools && !QueryDevtools) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      {RouterDevtools ? <RouterDevtools /> : null}
      {QueryDevtools ? <QueryDevtools /> : null}
    </Suspense>
  );
}
