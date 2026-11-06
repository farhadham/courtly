# AGENTS.md

## Project

**Courtly** — a sports-facility court booking app, built as a take-home challenge for Procimo.
Deadline: **Wed 11 Nov 2026, 10:32 Lisbon**. Deliverable: one **public** GitHub repo with a README.

Repo: <https://github.com/farhadham/courtly>

## Where the truth lives

Read these before writing code. They are the contract; do not re-litigate them.

| File | Contains |
|---|---|
| `docs/spec.md` | Domain model, business rules, API surface, error contract, test split |
| `GLOSSARY.md` | Canonical vocabulary. Use these words; challenge drift. |
| `docs/adr/` | Decisions with real trade-offs, and the alternatives rejected |
| `docs/decisions.md` | Full decision log from the design session, including assumptions |
| `docs/handoff.md` | Current build state and the next slice |
| GitHub issues | One per vertical slice; close only with evidence |

## Working agreement

- **The user defines tasks; the agent writes the code.** The user reviews.
- **The README and the challenge page's "Your decisions" text are written by the user**, never by the agent. The agent may supply raw material — commit messages, `docs/decisions.md`.
- One commit per slice, conventional commits, no mega-commits. The commit history is graded.
- Close an issue only after its acceptance criteria are verified by **running** them.
- Never claim something works without running it. Docker verification means `docker compose up -d --build` plus a real HTTP request.
- When a business rule changes, update `docs/spec.md` and `GLOSSARY.md` in the same commit.
- Add an ADR only when a decision is hard to reverse, surprising without context, and a real trade-off.

## Hard constraints — already decided, do not change without asking

- **npm workspaces.** No Bun, no pnpm, no yarn.
- **Node 22 LTS.** NestJS runs on Node. (Bun was considered and rejected: Nest v12 is Node-only.)
- **Postgres 16.** Double-booking is prevented by a database exclusion constraint, never by application code.
- **Money is integer cents.** Bookings snapshot `price_cents` at creation.
- **Cancelled bookings are soft-deleted**, excluded from the constraint by a partial `WHERE`.
- **All timestamps are `timestamptz`**; a "day" means a Europe/Lisbon calendar day.
- **Single origin in Docker**: nginx proxies `/api` to the API. No CORS.
- **Error shape**: `{ error: { code, message, details } }`, closed code enum in `packages/contracts`.
- **Tests**: pure unit for domain rules, real Postgres for DB-enforced rules. **Never mock the database** — mocking skips the `23P01` → 409 path, which is the thing being graded.
- **Vitest 5** (v3 carried critical `tinypool` advisories).

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `farhadham/courtly`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
