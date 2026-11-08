import { z } from 'zod';

/**
 * A local wall-clock time in the `HH:MM` form the court API speaks.
 */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time in HH:MM');
