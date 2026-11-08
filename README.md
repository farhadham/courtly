# Courtly

Sports facility booking: browse courts, see hourly availability, book one or two
hours, and cancel up to two hours before the start. Users manage their own
bookings; admins manage courts and see the day's takings.

## Run

Requires Docker; nothing needs to be installed locally.

```bash
git clone https://github.com/farhadham/courtly.git
cd courtly
docker compose up --build
```

Open **http://localhost:3000**. The `migrate` container runs the migrations and
the seed, then exits — that is expected.

| Role  | Email                     | Password     |
| ----- | ------------------------- | ------------ |
| User  | `user@courtly.test`       | `courtly123` |
| User  | `other.user@courtly.test` | `courtly123` |
| Admin | `admin@courtly.test`      | `courtly123` |

The seed creates 3 courts, 3 accounts and 6 bookings (past, upcoming and one
cancelled). The second user owns two future bookings, so availability already
shows taken slots and the double-booking rule can be tried from two sessions.

```bash
docker compose stop       # keep the database
docker compose down -v    # fresh database next time
```

## Stack choices

**React + Vite, not Next.js.** It is a single-page app behind a login, with no
SEO or server-rendering need, and the brief requires a separate backend anyway.
Vite builds static files that nginx serves, and TanStack Router/Query handle
routing, caching and invalidation.

**Express 5, not NestJS.** The domain is small and the hard rule lives in the
database, so a DI container and decorators would only add ceremony. Plain
routers and middleware keep the request path visible, and Express 5 forwards
async errors to one handler. More in `docs/adr/0003-express-over-nestjs.md`.

**PostgreSQL 16 + Drizzle.** The booking rule needs an interval exclusion
constraint, which is a native Postgres primitive; MySQL has no equivalent and
MongoDB cannot express "no overlapping ranges for the same court" declaratively.
Drizzle gives a typed schema and plain SQL migrations.

## How double bookings are prevented

A database constraint, not an application check:

```sql
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("court_id" WITH =, tstzrange("start_at", "end_at") WITH &&)
  WHERE ("status" <> 'CANCELLED');
```

It lives in `apps/api/drizzle/0001_booking_no_overlap.sql`. A `SELECT`-then-`INSERT`
check has a race between the two statements; the constraint runs inside the
insert, so one of two simultaneous requests always loses with SQLSTATE `23P01`.
That is mapped to `409 SLOT_TAKEN` in `apps/api/src/routes/bookings.ts`. Because
the constraint is partial, cancelling a booking keeps the row as history but
frees its slot.

Tests: `apps/api/test/db/constraints.test.ts` and
`apps/api/test/http/bookings.test.ts` fire two concurrent inserts and assert
exactly one wins.

## Tests

```bash
npm run test    # API + web
npm run check   # format, lint, typecheck
```

API tests cover the booking rules (duration, opening hours, past starts,
cancellation window) with pure unit tests, and the database-enforced rules
against real Postgres. Web tests cover the logic helpers. The full API contract
is in [`docs/spec.md`](docs/spec.md).

## Local development

Requires Node 22 and Docker (Postgres only).

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:migrate && npm run db:seed
npm run dev:api    # http://localhost:3001
npm run dev:web    # http://localhost:3000
```

Do not run the Docker stack and the local servers at the same time — they share
ports 3000, 3001 and 5432.

## What I would do next

- Real-time availability over SSE (`LISTEN/NOTIFY` + cache updates) instead of
  refetching the day.
- A waitlist promoted in the same transaction that cancels a booking.
- Seed 10k+ bookings and record `EXPLAIN ANALYZE` timings for the day view.
- Pagination for the admin day view and booking history.
- Harder auth: short-lived access tokens, refresh in an `httpOnly` cookie, login
  rate limiting.
