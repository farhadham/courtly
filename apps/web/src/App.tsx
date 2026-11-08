import { useEffect, useState } from 'react';
import type { HealthResponse } from '@courtly/contracts';
import { fetchData } from './lib/api';

type ApiState =
  { kind: 'loading' } | { kind: 'ok'; health: HealthResponse } | { kind: 'error'; message: string };

export default function App() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const health = await fetchData<HealthResponse>('/api/health');
        if (!cancelled) setApi({ kind: 'ok', health });
      } catch (error) {
        if (!cancelled) {
          setApi({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    void probe();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Courtly</h1>
        <p className="text-muted-foreground text-sm">Sports facility booking</p>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-medium">API</h2>
        {api.kind === 'loading' && <p className="text-sm">Checking…</p>}
        {api.kind === 'ok' && (
          <p className="text-sm text-green-700">Connected — uptime {api.health.uptimeSeconds}s</p>
        )}
        {api.kind === 'error' && (
          <p className="text-sm text-red-700">Unreachable — {api.message}</p>
        )}
      </section>
    </main>
  );
}
