import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { Router } from 'express';
import {
  availabilityQuerySchema,
  bookings,
  courtIdParamSchema,
  courtListQuerySchema,
  courts,
} from '@courtly/contracts';
import type { Court, CourtRow } from '@courtly/contracts';
import { requireAuthUser } from '../auth/middleware';
import type { AppDatabase } from '../db/client';
import {
  availabilityForDay,
  courtOpeningWindow,
  FACILITY_TIME_ZONE,
  localDateFromIso,
} from '../domain/availability';
import { ApiError } from '../http/errors';
import { data } from '../http/respond';

export interface CourtsRouterDependencies {
  db: AppDatabase;
  now?: () => Date;
}

/**
 * The database stores `time` values with seconds (`08:00:00`); the API speaks
 * the `HH:MM` form the spec uses, so the boundary normalises once here.
 */
export function toTimeOfDay(value: string): string {
  return value.slice(0, 5);
}

export function toCourtResponse(court: CourtRow): Court {
  return {
    id: court.id,
    name: court.name,
    sportType: court.sportType,
    hourlyPriceCents: court.hourlyPriceCents,
    opensAt: toTimeOfDay(court.opensAt),
    closesAt: toTimeOfDay(court.closesAt),
    isActive: court.isActive,
    timeZone: FACILITY_TIME_ZONE,
  };
}

/**
 * Court browsing for authenticated users. Inactive courts are excluded here;
 * the admin router has its own view that can include them.
 */
export function createCourtsRouter({
  db,
  now = () => new Date(),
}: CourtsRouterDependencies): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const parsed = courtListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid court query', {
        issues: parsed.error.issues,
      });
    }

    const filters: SQL[] = [];

    if (!(parsed.data.includeInactive === 'true' && requireAuthUser(req).role === 'ADMIN')) {
      filters.push(eq(courts.isActive, true));
    }

    if (parsed.data.sport) {
      filters.push(sql`lower(${courts.sportType}) = lower(${parsed.data.sport})`);
    }

    const rows = await db
      .select()
      .from(courts)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(courts.name);

    res.json(data(rows.map(toCourtResponse)));
  });

  router.get('/:id/availability', async (req, res) => {
    const parsedParams = courtIdParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new ApiError(404, 'NOT_FOUND', 'Court not found');
    }

    const parsedQuery = availabilityQuerySchema.safeParse(req.query);
    const date = parsedQuery.success ? localDateFromIso(parsedQuery.data.date) : null;

    if (!parsedQuery.success || !date) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid availability query', {
        issues: parsedQuery.success ? [] : parsedQuery.error.issues,
      });
    }

    const [court] = await db
      .select()
      .from(courts)
      .where(eq(courts.id, parsedParams.data.id))
      .limit(1);

    if (!court) {
      throw new ApiError(404, 'NOT_FOUND', 'Court not found');
    }

    const { opensAt, closesAt } = courtOpeningWindow(court, date);
    const activeBookings = await db
      .select({ startAt: bookings.startAt, endAt: bookings.endAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.courtId, court.id),
          eq(bookings.status, 'CONFIRMED'),
          lt(bookings.startAt, closesAt),
          gt(bookings.endAt, opensAt),
        ),
      );

    res.json(
      data(
        availabilityForDay({
          court,
          date,
          bookings: activeBookings,
          now: now(),
        }),
      ),
    );
  });

  router.get('/:id', async (req, res) => {
    const parsed = courtIdParamSchema.safeParse(req.params);

    if (!parsed.success) {
      throw new ApiError(404, 'NOT_FOUND', 'Court not found');
    }

    const [court] = await db.select().from(courts).where(eq(courts.id, parsed.data.id)).limit(1);

    if (!court) {
      throw new ApiError(404, 'NOT_FOUND', 'Court not found');
    }

    res.json(data(toCourtResponse(court)));
  });

  return router;
}
