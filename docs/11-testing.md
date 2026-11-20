# Testing and verification

## Environment

Verification was run on 2026-11-16 against the project's dedicated local Docker volumes using PostgreSQL 16.15 (`postgres:16-alpine`) and MongoDB 7. The working database ports are the documented defaults, 5432 and 27017. `.env.local` is ignored by Git and contains local credentials. Existing database volumes were left untouched.

## Automated results

| Command | Result |
|---|---|
| `npm run db:migrate` | Applied during initial database setup; not rerun on 2026-11-16 to preserve the already initialized, populated schema. |
| `npm run db:mongo` | Created or updated the `ps_mongo_app` user; validator and six indexes reported. |
| `npm run db:seed` | 19 areas, 51 users, 14 lots, and 224 slots; the existing 200,700 booking fixture was retained. |
| `npm run db:seed:bulk` | The existing bulk fixture is present in the 200,700 booking total; the bulk command was not rerun. |
| `npm test` | 5 test files passed; 26 tests passed (constraints 6, logic 7, RBAC 7, MongoDB 4, concurrency 2). |
| `npm run typecheck` | Passed with no TypeScript errors. |
| `npm run lint` | Passed with no warnings after replacing internal `location.href` navigation with `router.push`. |
| `npm run build -- --webpack` | Next.js 16 production build completed successfully and reported `ƒ Proxy (Middleware)`. The default Turbopack build could not create a junction in this Windows sandbox, so the supported Webpack build mode was used. |
| `npm audit` | Last recorded on 2026-11-12: 0 vulnerabilities; not rerun during this pass. |
| `npm run reconcile` | No PostgreSQL lots without profiles and no Mongo profiles without PostgreSQL rows. |
| `npx tsx scripts/query-catalog-smoke.ts` | Executed Q1–Q14; DML examples ran inside a transaction and were rolled back. |
| `npm run demo:race` | Naive check-then-insert accepted 20 overlapping rows; the exclusion-guarded run accepted exactly one. |

Earlier API checks covered duplicate and invalid registration, invalid vehicle values, customer role denial, booking retries, cancellation boundaries, and expired holds. The expanded current customer, owner, staff, and admin checks are listed below.

The MongoDB integration suite verifies the configured indexes, valid profile insertion, rejection of an invalid amenity, `$geoNear` output, amenity coverage aggregation, and validator shape. Test fixtures are removed after each run.

## Live application checks on 2026-11-16

- Production pages `/`, `/login`, and `/search` returned HTTP 200.
- A temporary customer completed register/login, vehicle create/list, amenity-filtered location search (8 lots), slot lookup, booking hold, simulated payment failure (402), successful retry (`CONFIRMED`), and cancellation (`CANCELLED_REFUNDED`). Customer access to owner and admin APIs returned 403.
- A temporary owner created a lot and MongoDB profile, updated the profile, generated and listed 20 slots, assigned a staff account, viewed the owner dashboard, and closed the empty lot. The assigned staff account logged in and loaded its assigned lots and arrivals. Admin stats, audit log, amenity analytics, reconciliation, and deletion of that empty test lot succeeded.
- All temporary customer, owner, staff, vehicle, booking, payment, audit, lot, profile, and slot data was removed. A final reconciliation returned empty mismatch lists.
- Reseeding synchronized the password hashes of the 51 known demo users with the configured `SEED_PASSWORD`; customer, owner, staff, and admin demo logins each returned HTTP 200.

The live checks exposed and fixed two route defects: owner bulk slot creation had its SQL parameters in the wrong order, and staff arrivals queried a security-invoker view that required access to `payments`. The staff endpoint now selects only booking, lot, slot, and vehicle columns, preserving payment restrictions. Code review also found and fixed the owner profile screen's amenity payload key; its button still needs a manual click check and screenshot.

## Remaining team evidence

The 32 manual UI scenarios and screenshots for every page have not all been run. In particular, parent-area search, regular-vehicle/EV-slot rejection, owner cross-lot editing, Mongo-unavailable rollback, lot closure with future bookings, staff early/unassigned check-in, and reconciliation after profile removal remain unverified. `docs/test-cases.md` records partial results without marking these paths as passed. `CONTRIBUTIONS.md` has the student names and SRNs; the work rows and real commit evidence remain team-provided because this checkout has no commits.
