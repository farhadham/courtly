/**
 * Shared API contract.
 *
 * Everything the API and the web app agree on lives here. Zod schemas are the
 * single source of truth: TypeScript types are inferred from them, so a change
 * to a schema is a compile error on both sides rather than a runtime surprise.
 */

export const CONTRACTS_VERSION = '0.1.0';

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
}
