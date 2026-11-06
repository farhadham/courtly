import { hashSync } from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { bookings, courts, users } from '@courtly/contracts';
import type { BookingStatus, UserRole } from '@courtly/contracts';
import { createDatabase } from './client';
import { databaseUrl } from './config';

const PASSWORD = 'courtly123';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const USER_IDS = {
  user: '11111111-1111-4111-8111-111111111101',
  otherUser: '11111111-1111-4111-8111-111111111102',
  admin: '11111111-1111-4111-8111-111111111103',
} as const;

const COURT_IDS = {
  padel1: '22222222-2222-4222-8222-222222222201',
  padel2: '22222222-2222-4222-8222-222222222202',
  tennis1: '22222222-2222-4222-8222-222222222203',
} as const;

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

interface SeedBooking {
  id: string;
  courtId: string;
  userId: string;
  startAt: Date;
  endAt: Date;
  durationHours: 1 | 2;
  priceCents: number;
  status: BookingStatus;
}

function bookingFixtures(now: Date): SeedBooking[] {
  const day = utcDayStart(now);
  const at = (dayOffset: number, hour: number): Date =>
    new Date(day.getTime() + dayOffset * DAY_MS + hour * HOUR_MS);

  return [
    {
      id: '33333333-3333-4333-8333-333333333301',
      courtId: COURT_IDS.padel1,
      userId: USER_IDS.user,
      startAt: at(-1, 9),
      endAt: at(-1, 10),
      durationHours: 1,
      priceCents: 2_000,
      status: 'CONFIRMED',
    },
    {
      id: '33333333-3333-4333-8333-333333333302',
      courtId: COURT_IDS.tennis1,
      userId: USER_IDS.otherUser,
      startAt: at(-1, 10),
      endAt: at(-1, 11),
      durationHours: 1,
      priceCents: 3_000,
      status: 'CANCELLED',
    },
    {
      id: '33333333-3333-4333-8333-333333333303',
      courtId: COURT_IDS.padel1,
      userId: USER_IDS.user,
      startAt: at(1, 9),
      endAt: at(1, 11),
      durationHours: 2,
      priceCents: 4_000,
      status: 'CONFIRMED',
    },
    {
      id: '33333333-3333-4333-8333-333333333304',
      courtId: COURT_IDS.padel2,
      userId: USER_IDS.otherUser,
      startAt: at(1, 9),
      endAt: at(1, 10),
      durationHours: 1,
      priceCents: 2_500,
      status: 'CONFIRMED',
    },
    {
      id: '33333333-3333-4333-8333-333333333305',
      courtId: COURT_IDS.tennis1,
      userId: USER_IDS.user,
      startAt: at(2, 18),
      endAt: at(2, 19),
      durationHours: 1,
      priceCents: 3_000,
      status: 'CONFIRMED',
    },
    {
      id: '33333333-3333-4333-8333-333333333306',
      courtId: COURT_IDS.padel1,
      userId: USER_IDS.otherUser,
      startAt: at(2, 18),
      endAt: at(2, 19),
      durationHours: 1,
      priceCents: 2_000,
      status: 'CONFIRMED',
    },
  ];
}

/**
 * Idempotent development seed. Every row has a stable id, so running it again
 * updates the fixture instead of inserting a duplicate.
 */
export async function seedDatabase(connectionString = databaseUrl()): Promise<void> {
  const { db, pool } = createDatabase(connectionString);
  const passwordHash = hashSync(PASSWORD, 10);

  const people: { id: string; email: string; passwordHash: string; role: UserRole }[] = [
    {
      id: USER_IDS.user,
      email: 'user@courtly.test',
      passwordHash,
      role: 'USER',
    },
    {
      id: USER_IDS.otherUser,
      email: 'other.user@courtly.test',
      passwordHash,
      role: 'USER',
    },
    {
      id: USER_IDS.admin,
      email: 'admin@courtly.test',
      passwordHash,
      role: 'ADMIN',
    },
  ];

  const facilities = [
    {
      id: COURT_IDS.padel1,
      name: 'Padel 1',
      sportType: 'padel',
      hourlyPriceCents: 2_000,
      opensAt: '08:00',
      closesAt: '23:00',
      isActive: true,
    },
    {
      id: COURT_IDS.padel2,
      name: 'Padel 2',
      sportType: 'padel',
      hourlyPriceCents: 2_500,
      opensAt: '08:00',
      closesAt: '23:00',
      isActive: true,
    },
    {
      id: COURT_IDS.tennis1,
      name: 'Tennis 1',
      sportType: 'tennis',
      hourlyPriceCents: 3_000,
      opensAt: '07:00',
      closesAt: '22:00',
      isActive: true,
    },
  ];

  try {
    await db
      .insert(users)
      .values(people)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`excluded.email`,
          passwordHash: sql`excluded.password_hash`,
          role: sql`excluded.role`,
        },
      });

    await db
      .insert(courts)
      .values(facilities)
      .onConflictDoUpdate({
        target: courts.id,
        set: {
          name: sql`excluded.name`,
          sportType: sql`excluded.sport_type`,
          hourlyPriceCents: sql`excluded.hourly_price_cents`,
          opensAt: sql`excluded.opens_at`,
          closesAt: sql`excluded.closes_at`,
          isActive: sql`excluded.is_active`,
        },
      });

    await db
      .insert(bookings)
      .values(bookingFixtures(new Date()))
      .onConflictDoUpdate({
        target: bookings.id,
        set: {
          courtId: sql`excluded.court_id`,
          userId: sql`excluded.user_id`,
          startAt: sql`excluded.start_at`,
          endAt: sql`excluded.end_at`,
          durationHours: sql`excluded.duration_hours`,
          priceCents: sql`excluded.price_cents`,
          status: sql`excluded.status`,
        },
      });
  } finally {
    await pool.end();
  }
}
