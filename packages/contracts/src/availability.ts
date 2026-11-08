import { z } from 'zod';

export const AVAILABILITY_STATUSES = ['AVAILABLE', 'TAKEN', 'PAST'] as const;

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/**
 * Query accepted by `GET /courts/:id/availability`. The date is a calendar day
 * in the facility's local time zone, not a UTC day.
 */
export const availabilityQuerySchema = z.object({
  date: z.iso.date(),
});

export const availabilitySlotSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  status: z.enum(AVAILABILITY_STATUSES),
});

export const availabilityResponseSchema = z.array(availabilitySlotSchema);

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
