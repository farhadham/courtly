# AGENTS.md

## Changing tests

A failing test is evidence, not an obstacle. This rule triggers when you edit, skip, or delete a test — not when one fails.

Before you modify a test, state in your response:

1. What behaviour the assertion encodes.
2. Where that behaviour comes from: `docs/spec.md`, an ADR in `docs/adr/`, `GLOSSARY.md`, or the originating issue.
3. Why the behaviour must now change.
4. The new assertion, and what it would fail on.

If the assertion traces to the spec, an ADR, or the glossary, stop and ask before continuing. That is a spec change: update the spec, ADR, or issue in the same change. The durable confirmation is that record, not an approval in chat.

Never make a test pass by weakening its assertions, skipping it, or mocking away the failure. Deleting a test is a last resort and is always reported.

## Changing migrations

Never edit a generated migration file by hand. Drizzle owns those files.

- **Schema change** — change the Drizzle schema, then regenerate:
  `npm run db:generate -w @courtly/api` from the repo root (or
  `npx drizzle-kit generate --name <name>` from `apps/api`).
- **Data or custom SQL** — generate an empty migration first, then fill it in:
  `npx drizzle-kit generate --custom --name <name>` from `apps/api`. Only the
  file drizzle-kit creates may be edited by hand; never touch a generated
  schema migration, the `meta/` journal, or the snapshots.

Migration order is creation order, so generate a migration that must run
earlier before the one that depends on it.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `farhadham/courtly`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
