/**
 * The success envelope every 2xx JSON body uses: `{ "data": ... }`. Failures
 * use the `{ "error": ... }` shape from `apiErrorSchema` instead; the two never
 * mix.
 *
 * This is a typing convention, not a runtime schema. Payloads keep their own
 * schemas (`courtSchema`, `availabilityResponseSchema`, ...) and describe what
 * sits inside `data`; the API wraps responses with `data()` in its HTTP layer.
 */
export type ApiData<T> = { data: T };
