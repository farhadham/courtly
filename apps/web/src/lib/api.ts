import { apiErrorSchema } from '@courtly/contracts';
import type { ApiData, ErrorCode } from '@courtly/contracts';
import { ZodError } from 'zod';
import type { ZodType, output as ZodOutput } from 'zod';

/**
 * The API lives behind the same origin under `/api` (Vite dev proxy and nginx
 * both strip the prefix), so the base path is the only place that knows where
 * the API is mounted.
 */
const API_BASE = '/api';

/**
 * A failed API call. `code` is the closed business code from the error
 * contract, or `null` when the body was not an error envelope at all.
 */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | null;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(input: {
    status: number;
    code: ErrorCode | null;
    message: string;
    details: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'ApiRequestError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

let bearerToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

/** The session store owns the token; the API layer only reads it. */
export function setApiToken(token: string | null): void {
  bearerToken = token;
}

/**
 * Wired once by the router module. A `UNAUTHORIZED` failure clears the session
 * and returns to login; the handler lives outside this module so the API stays
 * router-free.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/**
 * Only a missing or expired session resets the client. A `401` with any other
 * code — a wrong password on `/auth/login` — is the caller's error to render,
 * so this keys on the contract code rather than the status. A `401` without an
 * error envelope still counts, since no meaningful code is available.
 */
function isSessionGone(failure: ApiRequestError): boolean {
  return failure.code === 'UNAUTHORIZED' || (failure.code === null && failure.status === 401);
}

async function readError(response: Response): Promise<ApiRequestError> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const parsed = apiErrorSchema.safeParse(payload);

  if (parsed.success) {
    return new ApiRequestError({
      status: response.status,
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      details: parsed.data.error.details,
    });
  }

  return new ApiRequestError({
    status: response.status,
    code: null,
    message: `HTTP ${response.status}`,
    details: {},
  });
}

function isApiData(value: unknown): value is ApiData<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value;
}

/**
 * Fetches a JSON document and unwraps the `{ data }` success envelope once
 * (ADR-0004). The caller passes the contract schema for the payload, so the
 * response is validated before it is typed and the return type is inferred
 * from the schema. Failures reject with `ApiRequestError` carrying the contract
 * code; call sites never see the wire shape.
 */
export async function fetchData<TSchema extends ZodType>(
  path: string,
  schema: TSchema,
  init: RequestInit = {},
): Promise<ZodOutput<TSchema>> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (bearerToken) {
    headers.set('Authorization', `Bearer ${bearerToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!response.ok) {
    const failure = await readError(response);

    if (isSessionGone(failure)) {
      unauthorizedHandler?.();
    }

    throw failure;
  }

  const body: unknown = await response.json();

  if (!isApiData(body)) {
    throw new ApiRequestError({
      status: response.status,
      code: null,
      message: 'The API returned an unexpected body',
      details: {},
    });
  }

  try {
    return schema.parse(body.data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiRequestError({
        status: response.status,
        code: null,
        message: 'The API returned a body that does not match its contract',
        details: { issues: error.issues },
      });
    }

    throw error;
  }
}
