import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const BOOKING_STATUSES = ['CONFIRMED', 'CANCELLED'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: USER_ROLES }).notNull().default('USER'),
  },
  (table) => [check('users_role_valid', sql`${table.role} in ('USER', 'ADMIN')`)],
);

export const courts = pgTable(
  'courts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    sportType: text('sport_type').notNull(),
    hourlyPriceCents: integer('hourly_price_cents').notNull(),
    opensAt: time('opens_at').notNull(),
    closesAt: time('closes_at').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    check('courts_sport_type_length', sql`char_length(${table.sportType}) between 1 and 50`),
    check('courts_hourly_price_non_negative', sql`${table.hourlyPriceCents} >= 0`),
    check('courts_opening_window', sql`${table.opensAt} < ${table.closesAt}`),
  ],
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courtId: uuid('court_id')
      .notNull()
      .references(() => courts.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    durationHours: smallint('duration_hours').notNull(),
    priceCents: integer('price_cents').notNull(),
    status: text('status', { enum: BOOKING_STATUSES }).notNull().default('CONFIRMED'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('bookings_end_after_start', sql`${table.endAt} > ${table.startAt}`),
    check('bookings_duration_hours', sql`${table.durationHours} in (1, 2)`),
    check('bookings_status_valid', sql`${table.status} in ('CONFIRMED', 'CANCELLED')`),
    check('bookings_price_non_negative', sql`${table.priceCents} >= 0`),
  ],
);
