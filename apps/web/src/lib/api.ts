import type { ApiData } from '@courtly/contracts';

/**
 * Fetches a JSON document from the API and returns the payload inside the
 * `{ data }` success envelope. Failures reject rather than return: the API's
 * `{ error }` body is only useful for logging, not for typing a result.
 */
export async function fetchData<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const body = (await response.json()) as ApiData<T>;

  return body.data;
}
