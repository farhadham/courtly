# Express instead of NestJS for the HTTP layer

The API is built on Express 5 with plain routers and middleware. We started from a NestJS
scaffold, then replaced it before any feature code existed: the only thing Nest was providing at
that point was a controller decorator around `GET /health`, while the repository already had to
carry decorator compiler flags, `reflect-metadata`, `rxjs` and a module system that nothing used.

Express keeps the request path visible. The booking rules that matter live in two places — pure
domain functions and the PostgreSQL exclusion constraint (see ADR-0001) — and neither benefits
from a dependency-injection container. The HTTP layer only needs to parse input, call the domain,
and map errors to the contract. A router is enough for that, and a reviewer can follow it without
learning framework lifecycle hooks.

**Considered options**

- _NestJS_ — strong conventions and built-in guards, pipes and interceptors. Rejected because the
  challenge's domain is small, the database enforces the hard rule, and the framework's
  abstractions would sit between the reviewer and the code without removing work.
- _Fastify_ — faster and has schema-first validation. Rejected because the shared Zod contracts
  already provide validation and types, and Express is the smaller conceptual jump from the
  existing scaffold.
- _Bare `node:http`_ — rejected because body parsing, routing and error plumbing would become
  hand-written code that Express already gets right.

**Consequences**

- Authentication becomes middleware (`requireAuth`, `requireRole('ADMIN')`) applied by router
  mount point, not global guards plus decorator metadata.
- Validation calls the shared Zod schemas directly instead of going through a pipe.
- The error contract is a normal error-handling middleware, and `23P01` is still mapped in exactly
  one place.
- `createApp()` returns the application without listening, so HTTP tests exercise the real
  middleware stack through `supertest`.
- No decorators, no `reflect-metadata`, no DI container. TypeScript strict mode is unchanged.
- If the project later needs scheduled work, queues or a larger module graph, this decision is
  worth reopening; nothing in the domain model depends on it.
