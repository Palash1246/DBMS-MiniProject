# Implementation deviations and refinements

### DEV-01: `02_ddl_demo.sql` index drop order

- **Observation:** Dropping a column automatically removes dependent indexes; dropping the same index afterward raised `42704`.
- **Resolution:** Explicitly drop the index first with `DROP INDEX IF EXISTS`, then drop the column.
- **Status:** Reported verified by the team against PostgreSQL 16.

### DEV-02: Race demonstration uses isolated scratch relations

- **Observation:** `scripts/race-demo.ts` compares concurrent writers on two scratch relations in the `demo` schema.
- **Reason:** The demonstration avoids adding fake bookings or payments to application data.
- **Impact:** It illustrates the database concurrency invariant without adding fake application rows. The demonstration treats both exclusion conflicts (`23P01`) and deadlock victims (`40P01`) as losing requests; the automated suite separately confirms one winner for 20 same-slot calls.

### DEV-03: Team evidence remains partial

- **Observation:** The local query output and explain plan were captured. Student names and SRNs have been provided, but screenshots for the full manual walkthrough, individual contribution details, and commit hashes remain pending.
- **Reason:** Screenshots must show the UI pages selected for submission; individual work and real commit history must come from the team.

### DEV-04: Next.js 16 proxy follows the `src` application root

- **Observation:** With the App Router in `src/app`, the role-gating proxy in the repository root compiled but did not run for page requests.
- **Resolution:** Moved the Next.js 16 proxy entry point to `src/proxy.ts` and verified unauthenticated and wrong-role redirects over HTTP.

### DEV-05: Mongo setup is repeatable

- **Observation:** MongoDB reports users in the selected database, so an admin-database `usersInfo` lookup did not detect the existing application user on a second setup run.
- **Resolution:** Query the database-scoped user and update its password/role when it already exists. `npm run db:mongo` now succeeds on repeated runs.

### DEV-06: Bulk slot endpoint SQL parameter order

- **Observation:** Live owner API testing returned 422 when generating a batch of slots.
- **Cause:** The SQL placeholders expected `(lot id, prefix, slot type, count)`, while the API passed `(lot id, prefix, count, slot type)`.
- **Resolution:** Reordered the supplied values to match the SQL placeholders. Live verification created and listed 20 slots.

### DEV-07: Staff arrivals view permissions

- **Observation:** The staff arrivals API returned 500 with `permission denied for table payments`.
- **Cause:** The security-invoker `v_my_bookings` view joins `payments`, while the staff role intentionally has no payment-table access.
- **Resolution:** The staff arrivals endpoint now directly selects only booking, lot, slot, and vehicle fields. Live verification returned HTTP 200 without granting staff payment access.

### DEV-08: Demo seed password synchronization

- **Observation:** Existing demo users retained old password hashes when the seed was rerun with a new `SEED_PASSWORD`.
- **Resolution:** The idempotent user upsert now updates the password hash as well as the name. Reseeding synchronized all 51 demo users; customer, owner, staff, and admin logins returned HTTP 200.

### DEV-09: Owner profile amenity payload

- **Observation:** The owner profile screen sent `op`, while the profile API validates `amenity_op`.
- **Resolution:** The client now sends `amenity_op` for amenity add/remove actions. The API contract was live-tested; the button interaction still needs a screenshot/manual UI check.
