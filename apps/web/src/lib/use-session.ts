import { useSyncExternalStore } from 'react';
import type { Session } from './session';
import { getSession, subscribeSession } from './session';

/** Subscribes a component to the in-memory session store. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}
