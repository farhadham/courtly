# Courtly — Spec

A booking platform for a single sports facility. Users reserve courts by the hour; admins manage courts and observe the day's business.

Domain vocabulary is defined in [`GLOSSARY.md`](../GLOSSARY.md). Use those terms; don't invent synonyms.

## Roles

| Role      | Can                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **User**  | Browse active courts, view availability, book 1–2 consecutive hours, cancel own bookings within the window, list own bookings |
| **Admin** | Everything read-only, plus create/edit/deactivate courts and view all bookings for a day                                      |

Roles are enforced on the API by middleware. Hiding a button is not enforcement. Admins do not create bookings.

## Domain model

### Court

| Field                | Type    | Notes                                            |
| -------------------- | ------- | ------------------------------------------------ |
| `id`                 | uuid    |                                                  |
| `name`               | text    | unique                                           |
| `sport_type`         | text    | free label — padel, tennis, squash, … 1–50 chars |
| `hourly_price_cents` | integer | money is never a float                           |
| `opens_at`           | time    | local, e.g. `08:00`                              |
| `closes_at`          | time    | local, e.g. `23:00`                              |
| `is_active`          | boolean |                                                  |

Deactivating a court never deletes it and never deletes its bookings.

### Booking

| Field            | Type        | Notes                                                                   |
| ---------------- | ----------- | ----------------------------------------------------------------------- |
| `id`             | uuid        |                                                                         |
| `court_id`       | uuid        | FK → court                                                              |
| `user_id`        | uuid        | FK → user                                                               |
| `start_at`       | timestamptz |                                                                         |
| `end_at`         | timestamptz | `start_at + duration`                                                   |
| `duration_hours` | smallint    | `1` or `2`                                                              |
| `price_cents`    | integer     | **snapshot** of `court.hourly_price_cents × duration_hours` at creation |
| `status`         | text        | `CONFIRMED` or `CANCELLED`                                              |
| `created_at`     | timestamptz |                                                                         |

### User

`id`, `email` (unique), `password_hash`, `role` (`USER` | `ADMIN`). No registration — seeded only.

## Business rules

1. **Duration.** A booking is exactly 1 or 2 consecutive hours. Nothing else is accepted.
2. **Opening hours.** `start_at` must be at or after opening and `end_at` at or before closing, on that court's local day.
3. **Future only.** A booking is rejected when `start_at <= now()`.
4. **No overlap.** No two `CONFIRMED` bookings on the same court may overlap. Enforced by a PostgreSQL exclusion constraint, not by application code. Back-to-back is allowed: `[start, end)` bounds.
5. **Concurrency.** Two simultaneous requests for the same slot must produce exactly one booking. The loser receives `409 SLOT_TAKEN`.
6. **Cancellation window.** A booking may be cancelled while `now() <= start_at - interval '2 hours'`. Exactly two hours before is still cancellable.
7. **Ownership.** Only the booking's owner may cancel it. Admins cannot.
8. **Cancelled bookings.** Kept as rows with `status = 'CANCELLED'`. Their slots return to availability. They never count toward revenue.
9. **Price snapshot.** Revenue for a past booking is unaffected by later edits to the court's price.
10. **Inactive courts.** Not listed to users, refuse new bookings, keep existing bookings, and still count toward revenue.

## API surface

All routes require a JWT except `POST /auth/login`.

Every successful response is a single-key envelope, `{ "data": … }`. Failures
use `{ "error": … }` (see below); the two shapes never mix, so a client can
branch on which key is present.

```
POST   /auth/login                          → { data: { token, user } }

GET    /courts                              → { data: Court[] }; ?sport=padel; admin: ?includeInactive=true
GET    /courts/:id                          → { data: Court }
GET    /courts/:id/availability?date=YYYY-MM-DD → { data: Slot[] }

POST   /bookings                            → { data: Booking }; body { courtId, startAt, durationHours }
GET    /bookings/me?scope=upcoming|past     → { data: Booking[] }
POST   /bookings/:id/cancel                 → { data: Booking }

POST   /admin/courts                        → { data: Court }
PATCH  /admin/courts/:id                    → { data: Court }
GET    /admin/bookings?date=YYYY-MM-DD      → { data: { bookings[], totalRevenueCents } }
```

Cancellation is `POST /bookings/:id/cancel` rather than `DELETE`: it is a state transition with a rule attached, and the row survives.

## Error contract

Every failure returns:

```json
{ "error": { "code": "SLOT_TAKEN", "message": "…", "details": {} } }
```

Codes are a closed enum, typed in `packages/contracts`:

| Code                         | Status |
| ---------------------------- | ------ |
| `VALIDATION_FAILED`          | 400    |
| `UNAUTHORIZED`               | 401    |
| `FORBIDDEN`                  | 403    |
| `NOT_FOUND`                  | 404    |
| `SLOT_TAKEN`                 | 409    |
| `COURT_NAME_TAKEN`           | 409    |
| `CANCELLATION_WINDOW_CLOSED` | 409    |
| `BOOKING_ALREADY_CANCELLED`  | 409    |
| `BOOKING_IN_PAST`            | 422    |
| `OUTSIDE_OPENING_HOURS`      | 422    |
| `COURT_INACTIVE`             | 422    |

`23P01` (exclusion violation) maps to `SLOT_TAKEN` in exactly one place.

## Availability

For a court and a Lisbon calendar day, return every one-hour slot from `opens_at` to `closes_at`:

```json
{ "data": [{ "startsAt": "2026-11-07T08:00:00+00:00", "status": "AVAILABLE" }] }
```

`status` ∈ `AVAILABLE | TAKEN | PAST`. Past slots are shown, not hidden. A 2-hour booking marks both of its slots `TAKEN`. A slot is only a legal start if the requested duration fits before closing.

## Stack

| Layer     | Choice                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Monorepo  | npm workspaces — `apps/api`, `apps/web`, `packages/contracts`            |
| Runtime   | Node 22 LTS                                                              |
| Backend   | Express 5 — explicit routers and middleware                              |
| Database  | PostgreSQL 16                                                            |
| ORM       | Drizzle + `drizzle-zod`                                                  |
| Contracts | Zod schemas shared by API and web                                        |
| Frontend  | Vite + React + TanStack Query + shadcn/ui + Tailwind                     |
| Auth      | JWT (HS256), bcryptjs                                                    |
| Tests     | Vitest — pure unit for domain rules, real Postgres for DB-enforced rules |

## Testing

| Rule                | Where it lives | Test                           |
| ------------------- | -------------- | ------------------------------ |
| Duration ∈ {1,2}    | TypeScript     | unit                           |
| End ≤ closing time  | TypeScript     | unit                           |
| Start in future     | TypeScript     | unit, injected clock           |
| Cancellation window | TypeScript     | unit, injected clock           |
| No overlap          | Postgres       | integration                    |
| Concurrent insert   | Postgres       | integration, parallel requests |

Business rules are tested without mocks: pure functions are called directly; DB rules run against a real database. A rule that needs a mock to test is in the wrong layer.

## Out of scope

Registration, password reset, payments, email, multi-facility, recurring bookings, admin-initiated cancellation, waitlists, real-time updates (bonus only, if time).
