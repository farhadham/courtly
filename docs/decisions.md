# Decision log

Every decision made during the design session, what it beat, and why.
This is raw material for the README and the challenge page's "Your decisions" field — **write those yourself**.

## Stack

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Package manager | npm workspaces | Bun, pnpm, yarn | Bun was the original plan; dropped after research showed Nest v12 is Node-only and Bun's decorator metadata breaks under `tsconfig` `extends`. npm is the boring, reviewable default. |
| Runtime | Node 22 LTS | Bun runtime | Nest v12 is explicitly Node-only. Bun works unofficially but fails on DI metadata in common monorepo configs, and `bun test` had a silent-pass supertest bug. |
| Backend | NestJS | Express | The brief allows either. Nest's guards, decorators and module boundaries make role enforcement structural rather than a middleware afterthought. |
| Database | PostgreSQL 16 | MySQL, MongoDB | The non-overlap guarantee is the core of the brief; Postgres is the only one of the three with native range types and exclusion constraints. |
| ORM | Drizzle + `drizzle-zod` | Prisma, Kysely | `drizzle-zod` generates Zod schemas from the table definitions, giving one source of truth from Postgres → API validation → frontend types. Prisma also mis-reads exclusion constraints on introspection. |
| Frontend | Vite + React | Next.js | The brief requires a separate backend regardless, so Next's server features would be dead weight. Vite is the leanest SPA build. |
| UI | shadcn/ui + Tailwind | MUI, Chakra | Copy-in components, no runtime dependency, no design system to fight. |
| Server state | TanStack Query | SWR, manual fetch | Cache invalidation after booking/cancel is the main need; it does that out of the box. |
| Auth | JWT (HS256) | Server session cookie | Stateless, no session store, no cookie/CORS friction behind the nginx proxy. |
| Password hashing | bcryptjs | argon2 | Pure JS, so no native build step in the Docker image. |
| Test runner | Vitest 5 | Jest, `bun test` | One runner for API and web. v5 because v3 pulled critical `tinypool` advisories. |

## Domain model

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Opening hours | One `opens_at`/`closes_at` pair per court | Per-weekday schedule | The brief states a single example window. The schema leaves room to add a per-day table later without a rewrite. |
| Booking shape | One row: `start_at`, `end_at` | One row per booked hour | A booking is a duration, not a set of slots. Slot rows lose the contiguity guarantee and make cancellation a multi-row delete. |
| No-overlap enforcement | Postgres `EXCLUDE USING gist` on `tstzrange` | Application check; `UNIQUE` on slot rows; `SERIALIZABLE` | Check-then-insert has a race between the `SELECT` and the `INSERT`. See ADR-0001. |
| Constraint scope | Partial: `WHERE (status <> 'cancelled')` | Total constraint | A cancelled booking must return its slot to availability. |
| Cancellation storage | Soft: `status = 'CANCELLED'` | Hard delete | History is preserved, consistent with the brief's rule that deactivating a court must not erase history. |
| Money | Integer cents | `NUMERIC`, float | Exact arithmetic, no rounding policy to defend. Branded `Cents` type in TypeScript. |
| Booking price | Snapshot `price_cents` on the booking | Join to the court's current price | Editing a court's price must not rewrite past revenue. See ADR-0002. |
| Time | `timestamptz` in the DB, Europe/Lisbon at the edges | Naive `timestamp` | "Cannot book in the past" and "2 hours before" are instant comparisons. |
| Sport type | Free-text label, 1–50 chars | Closed enum of padel/tennis | The brief says "padel, tennis, etc." An enum would contradict it. Filter options are derived from the data. |

## Business rules

| Decision | Chosen | Why |
|---|---|---|
| Duration | Exactly 1 or 2 hours | Straight from the brief. |
| Back-to-back bookings | Allowed | `tstzrange` defaults to `[)` bounds, so 18:00–19:00 and 19:00–20:00 do not overlap. |
| Zero-length bookings | Impossible | `tstzrange(x, x)` is `empty` and overlaps nothing, so `CHECK (end_at > start_at)` is load-bearing. |
| Booking in the past | Rejected when `start_at <= now()` | Rule must be visible and testable, not hidden in the UI. |
| Cancellation boundary | Allowed while `now() <= start_at - 2h` | Exactly two hours before is still cancellable — the brief says "up to 2 hours before". |
| Who may cancel | The booking owner only | The brief gives admins court management and read-only booking visibility. Admins cannot cancel. |
| Deactivated court | Hidden from users, refuses new bookings, keeps existing bookings, still counts toward revenue | Auto-cancelling a customer's booking would be destructive and surprising. |
| Day revenue | `SUM(price_cents)` over non-cancelled bookings starting that Lisbon day, all courts including deactivated | Expected revenue, snapshot prices, no join. |

## API and contracts

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Type safety | Shared Zod package `packages/contracts` | tRPC, OpenAPI codegen | One schema gives compile-time types and runtime validation. tRPC fights Nest's controller/guard model; codegen is heavy for 5 days. |
| Cancellation verb | `POST /bookings/:id/cancel` | `DELETE /bookings/:id` | It is a state transition with a rule attached, and the row survives. |
| Admin namespace | `/admin/*` prefix with a route-level guard | Per-handler role checks | The guard is applied once, at the boundary, so a new admin route cannot forget it. |
| Error shape | `{ error: { code, message, details } }` | RFC 7807 `problem+json` | The frontend switches on a closed `code` enum; Zod types it so a new code cannot be invented client-side. |
| `23P01` mapping | → `SLOT_TAKEN` / 409, in exactly one place | — | Keeps Postgres specifics out of the service layer. |

## Delivery

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Monorepo layout | `apps/api`, `apps/web`, `packages/contracts` | Shared DB package | One consumer of the schema; no premature abstraction. |
| Migrations on boot | One-shot `migrate` service, API waits on `service_completed_successfully` | Entrypoint script in the API | No "first boot?" branching; restarting the API never re-runs migrations. |
| Browser → API | nginx reverse proxy on one origin | CORS with two ports | One URL, no CORS misconfiguration to debug during review. |
| Test database | Separate `courtly_test` DB on the compose Postgres | Testcontainers, pg-mem | The concurrency test needs a real engine; pg-mem cannot exercise an exclusion constraint. |
| Test style | Pure unit for domain rules, real DB for DB rules | Mocking the database | Mocking skips the `23P01` → 409 path and forces the mock to reimplement overlap semantics. |
| Scope | Core first; bonus only if the checklist is green | Bonus-first | The brief: "a finished core with no bonus beats a broken core with a bonus." |
| Bonus, if any | Real-time availability over SSE | Waitlist, 10k perf note | Smallest surface, most visible in a demo. |
| Workflow | Spec → issues → one commit per slice | Single-pass build | Clean history is graded; issues give the user a place to redirect mid-flight. |

## Assumptions worth knowing

- Ports: web `3000`, api `3001`, Postgres `5432`.
- Node 22 LTS in the image (`node:22-slim`), multi-stage build.
- No registration, no refresh tokens, no password reset — seeded users only.
- JWT: HS256, 1-hour expiry, payload `{ sub, role }`, secret from env.
- Every endpoint requires a JWT except `POST /auth/login`.
- Admins do not book; `POST /bookings` as an admin returns 403.
- Court names are unique.
- My-bookings lists are not paginated.
- Editing a court's opening hours or price does not invalidate existing bookings.
- Seed: 3 courts (2 padel, 1 tennis), 2 users, 1 admin, ~6 bookings split across past and future.
