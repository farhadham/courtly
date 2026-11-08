import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { Router } from 'express';
import {
  adminBookingsQuerySchema,
  bookings,
  courtCreateSchema,
  courtIdParamSchema,
  courtUpdateSchema,
  courts,
} from '@courtly/contracts';
import type { AppDatabase } from '../db/client';
import { isUniqueViolation } from '../db/errors';
import { localDateFromIso, localDayWindow } from '../domain/availability';
import { sumRevenue } from '../domain/revenue';
import { ApiError } from '../http/errors';
import { data } from '../http/respond';
import { toBookingResponse } from './bookings';
import { toCourtResponse, toTimeOfDay } from './courts';

export interface AdminRouterDependencies {
  db: AppDatabase;
}

/**
 * Admin-only court management. The role guard is applied at the `/admin` mount
 * point in `createApp`, so every route here can assume an ADMIN principal.
 */
export function createAdminRouter({ db }: AdminRouterDependencies): Router {
  const router = Router();

  /**
   * The operational day view: every booking whose start falls inside the
   * requested Lisbon day, across all courts and including deactivated ones.
   * Revenue sums the snapshotted price of non-cancelled rows (ADR-0002), so it
   * stays a historical fact when a court's price changes later.
   */
  router.get('/bookings', async (req, res) => {
    const parsed = adminBookingsQuerySchema.safeParse(req.query);
    const date = parsed.success ? localDateFromIso(parsed.data.date) : null;

    if (!parsed.success || !date) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid booking date', {
        issues: parsed.success ? [] : parsed.error.issues,
      });
    }

    const { startsAt, endsAt } = localDayWindow(date);
    const rows = await db
      .select()
      .from(bookings)
      .where(and(gte(bookings.startAt, startsAt), lt(bookings.startAt, endsAt)))
      .orderBy(asc(bookings.startAt));

    const totalRevenueCents = sumRevenue(rows);

    res.json(data({ bookings: rows.map(toBookingResponse), totalRevenueCents }));
  });

  router.post('/courts', async (req, res) => {
    const parsed = courtCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid court', {
        issues: parsed.error.issues,
      });
    }

    const [court] = await db
      .insert(courts)
      .values({ ...parsed.data, isActive: parsed.data.isActive ?? true })
      .returning()
      .catch((error: unknown) => {
        if (isUniqueViolation(error, 'courts_name_unique')) {
          throw new ApiError(409, 'COURT_NAME_TAKEN', 'A court with this name already exists');
        }

        throw error;
      });

    if (!court) {
      throw new Error('Court insert did not return a row');
    }

    res.status(201).json(data(toCourtResponse(court)));
  });

  router.patch('/courts/:id', async (req, res) => {
    const id = courtIdParamSchema.safeParse(req.params);

    if (!id.success) {
      throw new ApiError(404, 'NOT_FOUND', 'Court not found');
    }

    const parsed = courtUpdateSchema.safeParse(req.body);

    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid court update', {
        issues: parsed.success ? [] : parsed.error.issues,
      });
    }

    const [existing] = await db.select().from(courts).where(eq(courts.id, id.data.id)).limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Court not found');
    }

    // Cross-field rules such as the opening window span both the stored values
    // and the patch, so the merged court is validated as a whole.
    const merged = courtCreateSchema.safeParse({
      name: existing.name,
      sportType: existing.sportType,
      hourlyPriceCents: existing.hourlyPriceCents,
      opensAt: toTimeOfDay(existing.opensAt),
      closesAt: toTimeOfDay(existing.closesAt),
      isActive: existing.isActive,
      ...parsed.data,
    });

    if (!merged.success) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid court update', {
        issues: merged.error.issues,
      });
    }

    const [court] = await db
      .update(courts)
      .set(merged.data)
      .where(eq(courts.id, id.data.id))
      .returning()
      .catch((error: unknown) => {
        if (isUniqueViolation(error, 'courts_name_unique')) {
          throw new ApiError(409, 'COURT_NAME_TAKEN', 'A court with this name already exists');
        }

        throw error;
      });

    if (!court) {
      throw new ApiError(404, 'NOT_FOUND', 'Court not found');
    }

    res.json(data(toCourtResponse(court)));
  });

  return router;
}
