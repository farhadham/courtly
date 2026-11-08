import { loginResponseSchema } from '@courtly/contracts';
import type { LoginResponse } from '@courtly/contracts';
import { setApiToken } from './api';

export type Session = LoginResponse;

const STORAGE_KEY = 'courtly.session';

let session: Session | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getSession(): Session | null {
  return session;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function persist(next: Session | null): void {
  if (next) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Restores the persisted session before the router renders, so a reload does
 * not bounce through `/login`. The token is trusted until the API rejects it;
 * a stored value that no longer matches the contract is discarded.
 */
export function restoreSession(): Session | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const parsed = loginResponseSchema.safeParse(JSON.parse(stored) as unknown);

    if (!parsed.success) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    session = parsed.data;
    setApiToken(session.token);
    return session;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function startSession(next: Session): void {
  session = next;
  setApiToken(next.token);
  persist(next);
  emit();
}

export function clearSession(): void {
  if (session === null) {
    return;
  }

  session = null;
  setApiToken(null);
  persist(null);
  emit();
}
