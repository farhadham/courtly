import type { ApiData } from '@courtly/contracts';

/**
 * Wraps a successful payload in the API's `{ data }` envelope.
 *
 * The wrapper is deliberately unvalidated: resource schemas describe the
 * payload, not the transport, and the project does not validate outbound JSON.
 * Callers keep sending whatever their existing schema says the payload is.
 */
export function data<T>(payload: T): ApiData<T> {
  return { data: payload };
}
