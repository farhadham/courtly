import { useSyncExternalStore } from 'react';
import type { Session } from './session';
import { getSession, subscribeSession } from './session';

/** Subscribes a component to the in-memory session store. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}

/**
 * Whether the signed-in user is an administrator. This mirrors the API's role
 * guard only to decide which screens and actions render; the API remains the
 * enforcement point.
 */
export function useIsAdmin(): boolean {
  return useSession()?.user.role === 'ADMIN';
}
