import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { timeOfDaySchema } from './primitives';
import { courts } from './schema';

export const courtRowSchema = createSelectSchema(courts);
export const courtInsertSchema = createInsertSchema(courts);

/**
 * A court as the API returns it. Times are normalised to `HH:MM`; the database
 * stores them with seconds.
 */
export const courtSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sportType: z.string(),
  hourlyPriceCents: z.number().int(),
  opensAt: timeOfDaySchema,
  closesAt: timeOfDaySchema,
  isActive: z.boolean(),
  // IANA zone the court's opening hours are expressed in, so clients format
  // slot instants in the facility's clock rather than the viewer's.
  timeZone: z.string().min(1),
});

export const courtIdParamSchema = z.object({ id: z.uuid() });

/**
 * Court fields accepted when an admin creates one. `isActive` defaults to true
 * at the persistence layer when omitted.
 */
const courtFieldsSchema = z.object({
  name: z.string().trim().min(1),
  sportType: z.string().trim().min(1).max(50),
  hourlyPriceCents: z.number().int().positive(),
  opensAt: timeOfDaySchema,
  closesAt: timeOfDaySchema,
  isActive: z.boolean().optional(),
});

export const courtCreateSchema = courtFieldsSchema.refine(
  (court) => court.closesAt > court.opensAt,
  {
    message: 'closesAt must be after opensAt',
    path: ['closesAt'],
  },
);

export const courtUpdateSchema = courtFieldsSchema.partial();

/**
 * Query accepted by `GET /courts`. `includeInactive` only has an effect for an
 * admin; the browser router ignores it for everyone else.
 */
export const courtListQuerySchema = z.object({
  sport: z.string().min(1).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

export type Court = z.infer<typeof courtSchema>;
export type CourtRow = z.infer<typeof courtRowSchema>;
export type CourtCreate = z.infer<typeof courtCreateSchema>;
export type CourtUpdate = z.infer<typeof courtUpdateSchema>;
export type CourtListQuery = z.infer<typeof courtListQuerySchema>;
