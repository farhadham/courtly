# Defense notes

## Auth: token in the response, not cookies

**Decision:** Login returns `{ token, user }`. The client sends
`Authorization: Bearer <token>`.

**Why:** stateless API + SPA, explicit contract, no CSRF, simple to test, fits
the JWT/role scope.

**Trade-off:** XSS can read the token. Cookies hide it from JavaScript but need
a full CSRF flow. Half-done cookies are worse.

**One-liner:** "Bearer token fits the stateless SPA and avoids CSRF. Cookies
would need a full CSRF flow to be safer, which is extra scope this challenge
doesn't need."

## HTTP: Express 5, not NestJS

**Decision:** Plain Express routers and middleware. `createApp()` is the one
place where public routes, protected routes and the error handler are wired.

**Why:** I've mostly worked with Hono-style middleware frameworks. Express 5 is
the same router → middleware → handler model, so there was no new mental model
to learn under time pressure. It also fits the small domain: no DI container, no
decorators, no `reflect-metadata`. Express 5 forwards async route errors to the
error middleware, which keeps the auth code flat.

**Trade-off:** NestJS gives more structure, but it would sit between the reviewer
and a small API. Hono would also fit; Express was already the scaffold and the
lower-risk choice.

**One-liner:** "The HTTP layer only parses input, calls the domain and maps
errors. Express's middleware model does that with less ceremony than NestJS."

## Testing: unit rules, real HTTP, real Postgres

**Setup:** Vitest. `createApp({ db, jwtSecret })` lets `supertest` exercise the
real middleware stack without opening a port.

- **Unit** (`test/unit`): pure token rules — HS256, one-hour expiry, wrong secret.
- **HTTP** (`test/http`): login, `401`, `403`, error shape and unknown routes
  through the real app, with seeded users in Postgres.
- **DB** (`test/db`): exclusion constraint, concurrent inserts, seed idempotency
  against real Postgres.

**Safety and isolation:** global setup creates the `*_test` database if missing
and runs migrations; the code refuses any database not ending in `_test`.
`fileParallelism` is off, and each DB-backed file truncates before seeding so
files can't pollute each other. No mocks for domain rules.

**One-liner:** "Pure rules are unit-tested; anything the database enforces is
tested against a real database, and HTTP behaviour goes through the real app."

<!-- Add more defense notes below. -->
