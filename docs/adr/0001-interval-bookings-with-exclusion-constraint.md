# Interval bookings enforced by a PostgreSQL exclusion constraint

A booking is stored as one row with `start_at` and `end_at`, and non-overlap is enforced by
`EXCLUDE USING gist (court_id WITH =, tstzrange(start_at, end_at) WITH &&)`, made partial with
`WHERE (status <> 'cancelled')`. We chose this over the two obvious alternatives — a
one-row-per-hour slot table with a unique index, and an application-level "check then insert" —
because the check-then-insert pattern has a race between the `SELECT` and the `INSERT` that no
amount of UI or service-layer validation closes. The constraint lives in the schema, so it holds
for any client, including `curl`.

**Considered options**

- _Slot rows + `UNIQUE (court_id, slot_start)`_ — also race-safe, and easier to explain. Rejected
  because a booking becomes N rows, cancellation becomes a multi-row delete, a 2-hour booking's
  contiguity is no longer expressed by the schema, and changing the granularity is a rewrite.
- _Application-level overlap check_ — rejected outright. Two concurrent requests both see the slot
  as free and both insert. This is the exact failure the brief asks about.
- _`SERIALIZABLE` isolation_ — would work, but pushes retry handling into every write path and is
  harder to demonstrate in a code review than one constraint.

**Consequences**

- The `btree_gist` extension is required for `court_id WITH =`.
- `tstzrange` defaults to `[)` bounds, so back-to-back bookings do not conflict — which is what we want.
- A zero-length range is `empty` and overlaps nothing, so `CHECK (end_at > start_at)` is part of the
  design rather than defensive coding.
- Violations raise SQLSTATE `23P01`, mapped to `SLOT_TAKEN` / 409 in one place.
- Drizzle cannot express `EXCLUDE` in its schema DSL, so the constraint lives in a hand-written
  migration. This is deliberate, not an oversight.
