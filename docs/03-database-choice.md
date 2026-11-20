# Database choice

## PostgreSQL

Users, vehicles, areas, lots, staff assignments, slots, bookings, payments, reviews, and the audit trail have defined relationships and require transactions or referential integrity. PostgreSQL provides these guarantees with primary and foreign keys, `CHECK` and `UNIQUE` constraints, functions, procedures, triggers, views, indexes, and row-level security. The core invariant is `EXCLUDE USING gist (slot_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)` for held and confirmed bookings.

## MongoDB

Lot profiles have flexible attributes such as amenities, operating hours, photos, and advisory price bands. A strict JSON Schema validator guards the document shape; a `2dsphere` index supports nearby search and a weighted text index supports descriptive search. `pricing_rules` are advisory. The PostgreSQL `calc_booking_amount` function is the sole source for charged estimates.

## Consistency strategy

Lot creation allocates the Mongo ObjectId first, inserts the PostgreSQL row and Mongo document in one application transaction sequence, and removes the Mongo document if the SQL operation fails. Deletion commits PostgreSQL first and then deletes Mongo; reconciliation reports any orphan if the second operation fails. This is a compensating dual write, not a distributed transaction. A transactional outbox would be a production-scale improvement.

## Isolation and security

READ COMMITTED is sufficient for the slot invariant because the exclusion constraint coordinates competing inserts. API sessions use a transaction, `SET LOCAL ROLE` from a fixed whitelist, and transaction-local user/role settings. RLS filters reads; security-definer routines validate sensitive workflow writes. Views use `security_invoker = true`.
