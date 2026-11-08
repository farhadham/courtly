/**
 * Shared API contract.
 *
 * Everything the API and the web app agree on lives here. Zod schemas are the
 * single source of truth: TypeScript types are inferred from them, so a change
 * to a schema is a compile error on both sides rather than a runtime surprise.
 *
 * This entry point is the package's only public surface. Schemas live in a
 * module per domain resource; import them from here, never from the modules.
 */

export {
  BOOKING_STATUSES,
  USER_ROLES,
  bookings,
  courts,
  users,
  type BookingStatus,
  type UserRole,
} from './schema';

export const CONTRACTS_VERSION = '0.2.0';

export type { ApiData } from './envelope';
export type { HealthResponse } from './health';

export { ERROR_CODES, apiErrorSchema } from './errors';
export type { ApiErrorBody, ErrorCode } from './errors';

export { authUserSchema, loginRequestSchema, loginResponseSchema } from './auth';
export { userRowSchema } from './auth';
export type { AuthUser, LoginRequest, LoginResponse, UserRow } from './auth';

export { timeOfDaySchema } from './primitives';

export {
  courtCreateSchema,
  courtIdParamSchema,
  courtListQuerySchema,
  courtRowSchema,
  courtSchema,
  courtUpdateSchema,
} from './court';
export type { Court, CourtCreate, CourtListQuery, CourtRow, CourtUpdate } from './court';

export {
  bookingCreateSchema,
  bookingIdParamSchema,
  bookingRowSchema,
  bookingSchema,
} from './booking';
export type { Booking, BookingCreate, BookingRow } from './booking';

export {
  AVAILABILITY_STATUSES,
  availabilityQuerySchema,
  availabilityResponseSchema,
  availabilitySlotSchema,
} from './availability';
export type { AvailabilityQuery, AvailabilitySlot, AvailabilityStatus } from './availability';
