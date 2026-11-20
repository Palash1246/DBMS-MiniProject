# Implementation notes

## PostgreSQL files

- `00_roles_extensions.sql`: database roles and `btree_gist` extension.
- `01_schema.sql`: area hierarchy, relational entities, keys, checks, composite vehicle ownership FK, and temporal exclusion constraint.
- `02_ddl_demo.sql`: isolated scratch DDL demonstrating `CREATE`, `ALTER`, and `DROP`.
- `03_functions.sql`: session identity helpers, availability/pricing, booking lifecycle, gate operations, staff creation, and emergency lot closure.
- `04_triggers.sql`: status audit, payment confirmation, immutable audit, review visit check, lot integrity, staff integrity.
- `05_views.sql`: occupancy, revenue, peak hours, and unified bookings; each view is a security invoker.
- `06_indexes.sql`: GiST and workload indexes.
- `07_rls_grants.sql`: role grants, row policies, column-level password protection, and routine execution rights.
- `99_queries.sql`: query catalog Q1-Q14, including recursive CTE, correlated/nested queries, window rank, anti-join, set operation, and DML.

## MongoDB

`db/mongo/setup.ts` creates the least-privilege app user, strict `lot_profiles` validator, unique PostgreSQL id index, `2dsphere` index, amenity index, weighted text index, and locality index. `db/mongo/pipelines.ts` exports the nearby `$geoNear`/`$facet` and amenity coverage pipelines. Nearby and text search use separate indexes and endpoints because `$geoNear` must lead its pipeline and cannot share a pipeline with `$text`.

## Application security

`withDb` wraps each role-bound request in a transaction, maps application roles through a fixed PostgreSQL role whitelist, and sets transaction-local identity. Passwords use bcrypt cost 12. `jose` issues two-hour HS256 tokens in `ps_session`; the Next.js 16 `src/proxy.ts` verifies them for page navigation, while every API performs a role check again. PostgreSQL RLS remains the final data boundary. The login rate limiter is in-memory and is intended for local demonstration; production requires a shared store.

## Workflow

Creating a booking calls `sp_create_booking`, which expires stale holds, verifies the vehicle and slot, calculates price, inserts a held row and pending payment, and lets the exclusion constraint arbitrate races. Successful simulated payment updates `payments`; a trigger confirms the booking. A scheduler and on-demand sweep update expired statuses. Check-in/out and closure use stored routines.

## Verification status

Fresh verification is recorded in [the test report](11-testing.md): 26 automated tests passed against local PostgreSQL 16.15 and MongoDB 7, the demo data and 200,000-row performance fixture were loaded, API registration/login/role/search/vehicle checks passed, and the production build and typecheck passed. Manual page screenshots and student contribution details remain team-provided evidence.
