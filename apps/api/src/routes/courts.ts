import { and, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { Router } from 'express';
import { courtIdParamSchema, courtListQuerySchema, courts } from '@courtly/contracts';
import type { Court } from '@courtly/contracts';
import type { AppDatabase } from '../db/client';
import { ApiError } from '../http/errors';

export interface CourtsRouterDependencies {
  db: AppDatabase;
}

interface CourtRowLike {
  id: string;
  name: string;
  sportType: string;
  hourlyPriceCents: number;
  opensAt: string;
  closesAt: string;
  isActive: boolean;
}

/**
 * The database stores `time` values with seconds (`08:00:00`); the API speaks
 * the `HH:MM` form the spec uses, so the boundary normalises once here.
 */
export function toTimeOfDay(value: string): string {
  return value.slice(0, 5);
}

export function toCourtResponse(court: CourtRowLike): Court {
  return {
    id: court.id,
    name: court.name,
    sportType: court.sportType,
    hourlyPriceCents: court.hourlyPriceCents,
    opensAt: toTimeOfDay(court.opensAt),
    closesAt: toTimeOfDay(court.closesAt),
    isActive: court.isActive,
  };
}

/**
 * Court browsing for authenticated users. Inactive courts are excluded here;
 * the admin router has its own view that can include them.
 */
export function createCourtsRouter({ db }: CourtsRouterDependencies): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const parsed = courtListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid court query', {
        issues: parsed.error.issues,
      });
    }

    const filters: SQL[] = [];

    if (!(parsed.data.includeInactive === 'true' && req.auth?.role === 'ADMIN')) {
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

    res.json(rows.map(toCourtResponse));
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

    res.json(toCourtResponse(court));
  });

  return router;
}
