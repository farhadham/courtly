import type { ApiData } from '@courtly/contracts';

/**
 * Reads the payload out of a supertest response's `{ data }` success envelope.
 * Supertest types `res.body` as `any`; this keeps the one unavoidable cast out
 * of the assertions.
 */
export function payload<T = unknown>(response: { body: unknown }): T {
  return (response.body as ApiData<T>).data;
}
