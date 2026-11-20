# Conclusion

ParkSmart ties a functional parking reservation flow to database guarantees. PostgreSQL owns users, bookings, payments, pricing, and role boundaries; MongoDB serves validated lot profiles and spatial discovery. The overlap invariant is enforced by the temporal exclusion constraint rather than a race-prone application check.

## Design decisions

- The exclusion constraint prevents concurrent overlapping claims; READ COMMITTED is sufficient because the constraint arbitrates conflicting inserts.
- A composite vehicle/user foreign key prevents booking another customer's vehicle.
- RLS and security-definer routines put ownership checks in the database; the application also verifies JWT role claims.
- Flexible attributes and coordinates fit MongoDB, while transactional booking and payment data stay in PostgreSQL.
- Lot profile dual writes use compensation and a reconcile command because PostgreSQL and MongoDB do not share a transaction.
- Hold expiry uses an on-demand sweep plus the scheduler; a trigger cannot run on a timer.

## Future enhancements

Real payment provider, dynamic pricing, QR check-in, notifications, pg_cron, shared rate limiting, outbox-based cross-database sync, read replicas, materialized dashboards, and semantic search if the product scope supports it.

## Evaluation status

The local evaluation databases applied the schema and MongoDB setup successfully, loaded 51 fictional users, 14 lots, 224 spaces, 700 demo bookings, and a separate 200,000-booking performance fixture. The automated suite passed 26 tests, including MongoDB validation/aggregation and 20-way slot contention. Local API checks verified registration, login, duplicate and invalid registration errors, customer role denial, amenity-filtered search, vehicle creation, booking hold, payment failure and retry, and refund cancellation. The index demonstration changed the measured plan from a parallel sequential scan to an index scan on this local container; the timings are documented as a single-run illustration.

Before submission, the team still needs to manually accept the untested owner/staff/admin pages and area/EV cases, capture screenshots for its chosen walkthrough, fill in student names/SRNs and actual contributions in `CONTRIBUTIONS.md`, and record the real commit history. These details are intentionally left unclaimed until supplied by the team.
