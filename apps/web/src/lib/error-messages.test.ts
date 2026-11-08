import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './api';
import {
  CANCELLATION_CLOSED_MESSAGE,
  errorMessage,
  errorMessageForCode,
  GENERIC_ERROR_MESSAGE,
  SLOT_TAKEN_MESSAGE,
} from './error-messages';

describe('error code mapping', () => {
  it('maps the race loser to the slot-taken copy', () => {
    expect(errorMessageForCode('SLOT_TAKEN')).toBe('That slot was just taken');
    expect(SLOT_TAKEN_MESSAGE).toBe('That slot was just taken');
  });

  it('gives a wrong password its own copy, not the expired-session copy', () => {
    expect(errorMessageForCode('INVALID_CREDENTIALS')).toBe('Wrong email or password. Try again.');
    expect(errorMessageForCode('INVALID_CREDENTIALS')).not.toBe(
      errorMessageForCode('UNAUTHORIZED'),
    );
  });

  it('uses the same copy for the closed cancellation window', () => {
    expect(errorMessageForCode('CANCELLATION_WINDOW_CLOSED')).toBe(CANCELLATION_CLOSED_MESSAGE);
  });

  it('falls back to a generic sentence for an unknown or missing code', () => {
    expect(errorMessageForCode(null)).toBe(GENERIC_ERROR_MESSAGE);
    expect(errorMessageForCode(undefined)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('reads the code off an API failure and ignores server copy', () => {
    const failure = new ApiRequestError({
      status: 409,
      code: 'SLOT_TAKEN',
      message: 'This slot is already booked',
      details: {},
    });

    expect(errorMessage(failure)).toBe(SLOT_TAKEN_MESSAGE);
  });

  it('stays generic for a failure with no contract code', () => {
    const failure = new ApiRequestError({
      status: 500,
      code: null,
      message: 'HTTP 500',
      details: {},
    });

    expect(errorMessage(failure)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('stays generic for non-API errors', () => {
    expect(errorMessage(new Error('Failed to fetch'))).toBe(GENERIC_ERROR_MESSAGE);
  });
});
