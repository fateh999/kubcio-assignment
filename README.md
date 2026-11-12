# Clinic Management Prototype

Working prototype for a small clinic: visit handoffs (reception → nurse → doctor → reception), results waiting for review, and diabetes study candidates. Synthetic data only.

- [PRD](./Clinic%20Management%20Prototype%20—%20PRD.md)
- [Build spec](./SPEC.md)

> The full README (seeded staff emails, walkthrough, assumptions, build log) is written in task 6.

## Run locally

Requirements: Docker Desktop running, Bun 1.1+.

```bash
docker compose up -d          # Postgres on 5432, Mailpit on 1025/8025
bun install
cp .env.example .env.local
bun run db:push && bun run seed   # creates the tables, seeds patients and 6 staff accounts
bun dev                       # http://localhost:3000
```

`docker compose down -v` wipes the database for a fresh start.

## Scripts

| Script | What it does |
| --- | --- |
| `bun dev` | Next.js dev server |
| `bun run db:push` | Push the Drizzle schema to Postgres |
| `bun run seed` | Reset and seed synthetic data, run study matching, print staff emails |
| `bun run auth:generate` | Regenerate `src/db/auth-schema.ts` from the Better Auth config (output is committed) |
| `bun run typecheck` | Generate route types and run `tsc` |
| `bun run lint` | ESLint |
| `bun test` | Unit tests (matcher, visit stages); no database needed |
| `bun run test:db` | Database tests against local Postgres (visit transitions, incl. concurrent staff) |
