# Handoff

Current state of the build. Update this file at the end of every slice.

**Last updated:** Phase 0 complete.

## Done

| Phase | Issue | Commit | State |
|---|---|---|---|
| Scaffold, spec, ADRs | — | `f1a267a` | ✅ |
| 0 — Workspace skeleton + Docker compose | #1 | `a3b1a8d` | ✅ verified |
| 1 — Schema, exclusion constraint, seed | #2 | — | ⬜ **next** |
| 2 — Auth and role enforcement | #3 | — | ⬜ |
| 3 — Courts API and admin court management | #4 | — | ⬜ |
| 4 — Availability API | #5 | — | ⬜ |
| 5 — Bookings API and concurrency guarantee | #6 | — | ⬜ |
| 6 — Cancellation | #7 | — | ⬜ |
| 7 — My bookings and admin day view | #8 | — | ⬜ |
| 8a — Frontend: login, courts, availability, booking | #9 | — | ⬜ |
| 8b — Frontend: my bookings and admin | #10 | — | ⬜ |
| 9 — README, decisions, hand-in | #11 | — | ⬜ |

## What exists

```
/
├── AGENTS.md                  ← read this first
├── GLOSSARY.md
├── Dockerfile                 ← targets: deps, build, api, web
├── docker-compose.yml         ← db, migrate (one-shot), api, web
├── docs/
│   ├── spec.md                ← the contract
│   ├── decisions.md           ← every decision + rejected alternatives
│   ├── handoff.md             ← this file
│   ├── adr/
│   └── agents/
├── packages/contracts/        ← @courtly/contracts, built to dist/
├── apps/api/                  ← NestJS, health endpoint only
└── apps/web/                  ← Vite + React + Tailwind shell
```

## Verified baseline

```bash
npm install
npm run build          # contracts -> api -> web
npm run typecheck
docker compose up -d --build
curl http://localhost:3000/api/health     # {"status":"ok","uptimeSeconds":N}
```

The nginx proxy strips `/api`, so the browser calls `/api/health` and the API serves `/health`.

## Next slice — Phase 1 (issue #2)

1. Drizzle schema for `users`, `courts`, `bookings` in `apps/api`.
2. Hand-written migration adding:
   - `CREATE EXTENSION IF NOT EXISTS btree_gist`
   - `EXCLUDE USING gist (court_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (status <> 'cancelled')`
   - `CHECK (end_at > start_at)`, `CHECK (duration_hours IN (1,2))`
3. `drizzle-zod` schemas exported from `packages/contracts`.
4. Idempotent seed: 3 courts, 2 users, 1 admin, ~6 bookings.
5. `courtly_test` database for tests.

**Prove the constraint before writing any service code:** insert two overlapping confirmed
bookings for one court and show Postgres reject the second with `23P01`; then show back-to-back
succeeds and a cancelled row does not block its slot.

## Gotchas

- `migrate` currently runs `npm run db:migrate --if-present` and is a **no-op** until Phase 1 adds the script.
- The repo directory is still named `procimo-test` locally; the GitHub repo is `courtly`. Docker image names follow the compose `name: courtly` field.
- `gh` is installed at `C:\Program Files\GitHub CLI\gh.exe` and is **not on PATH** in a fresh shell — call it by full path.
- Git commits in this repo are made with `-c user.name=farhadham -c user.email=farhadham2@gmail.com`.
