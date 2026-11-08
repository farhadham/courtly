# Defense notes

## Auth: token in the response, not cookies

**Decision:** Login returns `{ token, user }`. The client sends
`Authorization: Bearer <token>`.

**Why:** stateless API + SPA, explicit contract, no CSRF, simple to test, fits
the JWT/role scope.

**Trade-off:** XSS can read the token. Cookies hide it from JavaScript but need
a full CSRF flow. Half-done cookies are worse.

**Storage:** the browser keeps the token in memory and persists it to
`localStorage` under `courtly.session`, so a reload does not sign the user out.
That makes the XSS trade-off above the accepted cost rather than an oversight.

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

## Frontend testing: logic only, not full UI

**Decision:** The web app is tested at the logic layer only: slot selection
(1 vs 2 hours, adjacency, fits before closing), the cancellation offer window,
facility-time formatting, and error code → message mapping. There are no
component/rendering tests and no browser E2E suite.

**Why:** Every business rule already has an owner. The API enforces duration,
opening hours, future-only, overlap and the cancellation window, and those rules
are covered by unit and real-Postgres tests. Re-checking them in the browser
would assert the same behaviour through a second, slower stack, and would need
mocks to isolate the UI — which the project's testing rule rejects. The web
layer's own job is presentation and wiring; that is checked by the manual smoke
pass against the seed data.

**Not a time shortcut:** this is a deliberate scope decision, not something
skipped under time pressure. If a screen grows branching logic of its own,
component tests with Testing Library would be added; today every screen reads
one typed API and renders it.

**Trade-off:** rendering regressions, focus order and responsive layout are not
caught automatically. Keyboard behaviour, focus visibility and the
`AVAILABLE`/`TAKEN`/`PAST` distinction are part of the manual checklist.

**One-liner:** "The rules are tested where they are enforced. Duplicating server
rules in the browser would only add mocks, so the web layer is checked by hand."

## Frontend: official agent skills only, gaps recorded

**Decision:** Install only the skills a library vendor ships, and record the
two that do not exist yet instead of substituting a community file.

| Tool           | Source                                                                 | Status                                                            |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| shadcn/ui      | `npx skills add shadcn/ui -a opencode`                                 | Installed under `.agents/skills/` (OpenCode reads that directory) |
| TanStack Query | Official Intent skill not published yet (TanStack/query#10810, #10879) | Gap — Query usage is kept in `src/queries/`                       |
| Tailwind CSS   | No official skill (tailwindlabs/tailwindcss#19594)                     | Gap — Tailwind v4 docs used directly                              |

**Why:** a community skill is unversioned advice from outside the library, so
it can drift from the installed version without any update path. A missing
skill is safer than a wrong one, and writing the gap down keeps its absence
from looking like an oversight.

**Trade-off:** Query and Tailwind guidance is not versioned with the dependency.
That is cheap here: Query usage is concentrated in `src/queries/`, and Tailwind
v4 is configured once in `src/index.css`.

**One-liner:** "I install vendor-shipped skills only; Query and Tailwind have
no official skill yet, so I documented the gap instead of importing unofficial
rules."

<!-- Add more defense notes below. -->
