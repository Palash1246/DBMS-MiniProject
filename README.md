# ParkSmart

ParkSmart is a Bengaluru parking reservation project for PES University DBMS Experiential Learning Level 3. It combines PostgreSQL 16 for transactional booking and access control with MongoDB 7 for flexible lot profiles and spatial search.

The central integrity rule is enforced by a PostgreSQL GiST exclusion constraint: a slot cannot have overlapping held or confirmed bookings. Payments are simulated; no real payment gateway is connected.

## Requirements

- Node.js 20 or newer and npm
- Docker Desktop with Compose v2
- Git

## Local setup

1. Copy `.env.example` to `.env.local`. Replace every example credential with local values. Keep the PostgreSQL and MongoDB root values consistent with the database containers.
2. Install dependencies with `npm install`.
3. Start PostgreSQL and MongoDB using `npm run db:up`.
4. On a fresh project database, run `npm run db:reset`. This drops and recreates the PostgreSQL `public` schema, configures MongoDB, and seeds fictional data. Do not run it on a database whose contents must be preserved.
5. Start the web app with `npm run dev` and open <http://localhost:3000>.

For a database that already has the PostgreSQL migrations, use `npm run db:mongo` followed by `npm run db:seed` instead of the destructive reset.

The seed data and coordinates are fictional/approximate. Set `SEED_PASSWORD` in `.env.local` to choose the password used by all demo accounts.

## Demo accounts

| Role | Email |
|---|---|
| Admin | `admin@parksmart.test` |
| Owner | `owner1@parksmart.test` through `owner4@parksmart.test` |
| Staff | `staff1@parksmart.test` through `staff6@parksmart.test` |
| Customer | `cust1@parksmart.test` through `cust40@parksmart.test` |

All use the configured `SEED_PASSWORD`.

## Useful commands

```sh
npm run db:up              # Start PostgreSQL 16 and MongoDB 7
npm run db:migrate         # Apply PostgreSQL SQL files in order
npm run db:mongo           # Configure Mongo user, validator and indexes
npm run db:seed            # Add deterministic demo data
npm run db:reset           # Destructive fresh database setup
npm run typecheck          # TypeScript validation
npm run build              # Production Next.js build
npm test                   # Run the checked-in Vitest suites
npm run cron:expire        # Call the protected hold-expiry route every minute
npm run demo:race          # Compare concurrent naive and constrained inserts
npm run reconcile          # Compare PostgreSQL lot ids and Mongo profiles
npm run db:seed:bulk       # Add 200,000 completed bookings for index analysis
npx tsx scripts/query-catalog-smoke.ts # Run Q1-Q14 safely and roll back DML examples
```

During `npm run dev`, PostgreSQL SQL statements issued by the app are printed in the same terminal and appended to `.logs/postgres-session.log`. Starting a new dev run starts a fresh log; stopping it with `Ctrl+C` deletes that session file. Parameter values are omitted from the log.

Database tests require the configured database services. `db:reset` removes PostgreSQL schema data; the normal seed is idempotent for the reference demo accounts and lots.

## Architecture and project files

- `db/postgres/00`–`07`: roles, schema, DDL demonstration, routines, triggers, views, indexes, and RLS grants.
- `db/postgres/99_queries.sql`: relational query catalog Q1-Q14.
- `db/mongo/setup.ts` and `db/mongo/pipelines.ts`: document validator, indexes, geospatial and aggregate pipelines.
- `src/lib`: environment validation, PostgreSQL/MongoDB singleton clients, auth/session, input validation, and error handling.
- `src/app/api`: Next.js route handlers; PostgreSQL work uses raw parameterized SQL.
- `src/app`: customer, owner, staff, and admin pages.
- `scripts`: expiry loop, isolated race demo, reconciliation, bulk data, and index-plan demonstration.
- `docs`: project write-up, schema figures, implementation notes, and team evidence TODOs.

## Verification and evidence

On 2026-11-16, all five Vitest suites passed (26 tests) against local PostgreSQL 16.15 and MongoDB 7. The production build, typecheck, lint, live customer/owner/staff/admin API checks, reconciliation, race demo, and query catalog results are recorded in `docs/11-testing.md`; the measured index plan is in `docs/performance.md`. Remaining work includes several specific manual acceptance paths and screenshots, plus each student's work summary and real commit evidence in `CONTRIBUTIONS.md`.
