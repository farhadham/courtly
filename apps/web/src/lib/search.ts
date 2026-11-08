import { z } from 'zod';

/**
 * Shared search-param contract for screens that pick one calendar day.
 * TanStack Router runs `validateSearch` on every navigation, including a
 * direct URL, so an invalid day is dropped before it reaches the API.
 */
const dateSearchSchema = z.object({ date: z.iso.date().optional() });

export function parseDateSearch(search: Record<string, unknown>): { date?: string } {
  const parsed = dateSearchSchema.safeParse(search);
  return parsed.success ? parsed.data : {};
}
