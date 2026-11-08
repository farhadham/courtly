import type { ErrorCode } from '@courtly/contracts';
import { ApiRequestError } from './api';

/**
 * User-facing copy for the closed API error set. A failure the UI cannot name
 * falls back to a generic sentence rather than showing a server string.
 */
const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Check the details and try again.',
  UNAUTHORIZED: 'Your session has expired. Sign in again.',
  INVALID_CREDENTIALS: 'Wrong email or password. Try again.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'We could not find that.',
  SLOT_TAKEN: 'That slot was just taken',
  COURT_NAME_TAKEN: 'A court with that name already exists.',
  CANCELLATION_WINDOW_CLOSED:
    'This booking can no longer be cancelled: the two-hour window closed.',
  BOOKING_ALREADY_CANCELLED: 'This booking is already cancelled.',
  BOOKING_IN_PAST: 'That start time is in the past.',
  BOOKING_OFF_SLOT: 'Bookings must start on a whole hour.',
  OUTSIDE_OPENING_HOURS: 'That time is outside the court opening hours.',
  COURT_INACTIVE: 'This court is not accepting bookings.',
};

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const SLOT_TAKEN_MESSAGE = MESSAGES.SLOT_TAKEN;
export const CANCELLATION_CLOSED_MESSAGE = MESSAGES.CANCELLATION_WINDOW_CLOSED;

/** The single mapping from an API code to copy. Unknown codes are generic. */
export function errorMessageForCode(code: ErrorCode | null | undefined): string {
  return code ? MESSAGES[code] : GENERIC_ERROR_MESSAGE;
}

/**
 * Turns any thrown value into user copy. Only an API failure with a known code
 * gets specific text; network and unknown failures stay generic.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return errorMessageForCode(error.code);
  }

  return GENERIC_ERROR_MESSAGE;
}
