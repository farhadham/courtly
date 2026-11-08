import { z } from 'zod';

/**
 * The closed set of business failure codes from the API error contract. Every
 * failure that a caller can act on carries exactly one of these codes.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'SLOT_TAKEN',
  'COURT_NAME_TAKEN',
  'CANCELLATION_WINDOW_CLOSED',
  'BOOKING_ALREADY_CANCELLED',
  'BOOKING_IN_PAST',
  'OUTSIDE_OPENING_HOURS',
  'COURT_INACTIVE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.string(), z.unknown()),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
