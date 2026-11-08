# Courtly

Sports facility booking: browse courts, see hourly availability, book one or two
hours, and cancel up to two hours before the start. Users manage their own
bookings; admins manage courts and see the day's revenue.

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

**React + Vite, not Next.js.** It's a single-page app behind a login, so SEO
and server rendering don't matter, and the brief wants a separate backend
anyway. Vite builds static files for nginx, and TanStack Router/Query handle
routing, caching and invalidation.

**Express 5, not NestJS.** The domain is small and the hard rule lives in the
database, so NestJS's dependency injection and decorators would mean more setup
for little gain. Plain routers keep the request path easy to follow, and
Express 5 sends async errors to one handler. More in
`docs/adr/0003-express-over-nestjs.md`.

**PostgreSQL 16 + Drizzle.** The double-booking rule is an interval exclusion
constraint, which Postgres has built in. MySQL has no equivalent, and MongoDB
can't express "no overlapping ranges for the same court" declaratively. Drizzle
gives a typed schema and plain SQL migrations.

## How double bookings are prevented

A database constraint, not an application check:

```sql
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("court_id" WITH =, tstzrange("start_at", "end_at") WITH &&)
  WHERE ("status" <> 'CANCELLED');
```

It lives in `apps/api/drizzle/0001_booking_no_overlap.sql`. A `SELECT` then
`INSERT` check leaves a race between the two statements; the constraint runs as
part of the insert, so one of two simultaneous requests always loses with
SQLSTATE `23P01`. That is mapped to `409 SLOT_TAKEN` in
`apps/api/src/routes/bookings.ts`. Because the constraint is partial, cancelling
keeps the row as history but frees its slot.

Tests: `apps/api/test/db/constraints.test.ts` and
`apps/api/test/http/bookings.test.ts` fire two concurrent inserts and assert
exactly one wins.

## Tests

The database rules run against real Postgres, so start the database container
first:

```bash
npm install
cp .env.example .env
docker compose up -d db
npm run test    # API + web
npm run check   # format, lint, typecheck
```

The suite creates `courtly_test` on first run and refuses any database whose
name does not end in `_test`. API tests cover the booking rules (duration,
opening hours, past starts, cancellation window) as unit tests, plus the
database rules against real Postgres. Web tests cover the logic helpers. The API
contract is in [`docs/spec.md`](docs/spec.md).

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

The Compose database is published on host port 5433, so it can run next to a
local PostgreSQL. Don't run the Docker web container and the Vite dev server at
the same time — both use port 3000. The API has no host port in Compose (nginx
proxies it), so 3001 is free locally.
