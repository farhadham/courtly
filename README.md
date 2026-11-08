# Courtly

Sports facility booking app: browse courts, view hourly availability, book 1–2 hours, cancel within the two-hour window. Users and admins have separate capabilities.

## Run with Docker

Requires Docker. No local `npm install` needed.

```bash
docker compose up -d --build
```

That starts PostgreSQL, builds the API and web images, runs migrations and the seed, then serves the app at:

**http://localhost:3000**

The `migrate` container exits after seeding — that is expected.

### Sign in

| Role  | Email                | Password     |
| ----- | -------------------- | ------------ |
| User  | `user@courtly.test`  | `courtly123` |
| Admin | `admin@courtly.test` | `courtly123` |

### Stop and restart

```bash
docker compose stop      # stop everything, keep the database
docker compose up -d     # start again (no rebuild)
```

After changing code:

```bash
docker compose up -d --build
```

### Fresh database

```bash
docker compose down -v   # removes containers and the Postgres volume
docker compose up -d --build
```

### Useful commands

```bash
docker compose ps        # container status
docker compose logs -f   # follow logs
```

## Run locally (development)

Requires Node 22 and Docker (for Postgres only).

```bash
npm install
docker compose stop web api
npm run db:migrate
npm run db:seed
npm run dev:api    # terminal 1 — http://localhost:3001
npm run dev:web    # terminal 2 — http://localhost:3000
```

Do not run the Docker stack and the local servers at the same time; they share ports 3000, 3001 and 5432.

## Checks

```bash
npm run check   # format, lint, typecheck
npm run test    # API + web tests
```
