# Relational schema

The notation follows the course slides' relational-schema format. A **solid underline** denotes the primary key. A **dotted underline** denotes a foreign-key attribute; arrows in the reference list below run from each foreign key to the referenced primary key. Where an attribute is both, both markings apply.

## PostgreSQL relations

**AREAS**(<u>area_id</u>, name, level, <span style="text-decoration: underline dotted">parent_area_id</span>)

**USERS**(<u>user_id</u>, name, email, phone, password_hash, role, created_at)

**VEHICLES**(<u>vehicle_id</u>, <span style="text-decoration: underline dotted">user_id</span>, reg_number, vehicle_type)

**PARKING_LOTS**(<u>lot_id</u>, <span style="text-decoration: underline dotted">owner_id</span>, <span style="text-decoration: underline dotted">area_id</span>, name, mongo_lot_id, base_rate_per_hr, is_active, created_at)

**LOT_STAFF**(<u><span style="text-decoration: underline dotted">lot_id</span></u>, <u><span style="text-decoration: underline dotted">user_id</span></u>, assigned_at)

**SLOTS**(<u>slot_id</u>, <span style="text-decoration: underline dotted">lot_id</span>, slot_label, slot_type, status)

**BOOKINGS**(<u>booking_id</u>, booking_code, <span style="text-decoration: underline dotted">user_id</span>, <span style="text-decoration: underline dotted">vehicle_id</span>, <span style="text-decoration: underline dotted">slot_id</span>, start_time, end_time, status, amount, expires_at, created_at, checked_in_at, checked_out_at)

**PAYMENTS**(<u>payment_id</u>, <u><span style="text-decoration: underline dotted">booking_id</span></u>, amount, method, status, paid_at, created_at)

**REVIEWS**(<u>review_id</u>, <span style="text-decoration: underline dotted">user_id</span>, <span style="text-decoration: underline dotted">lot_id</span>, rating, comment, created_at)

**BOOKING_AUDIT_LOG**(<u>log_id</u>, <span style="text-decoration: underline dotted">booking_id</span>, old_status, new_status, changed_by, changed_at)

Alternate unique keys: `AREAS.(name,parent_area_id)`, `USERS.email`, `USERS.phone`, `VEHICLES.reg_number`, `VEHICLES.(vehicle_id,user_id)`, `PARKING_LOTS.mongo_lot_id`, `PARKING_LOTS.(owner_id,name)`, `SLOTS.(lot_id,slot_label)`, `BOOKINGS.booking_code`, and `REVIEWS.(user_id,lot_id)`. `PAYMENTS.booking_id` is both unique and a foreign key.

### Foreign-key references

```text
AREAS.parent_area_id                         -> AREAS.area_id
VEHICLES.user_id                             -> USERS.user_id
PARKING_LOTS.owner_id                        -> USERS.user_id
PARKING_LOTS.area_id                         -> AREAS.area_id
LOT_STAFF.lot_id                             -> PARKING_LOTS.lot_id
LOT_STAFF.user_id                            -> USERS.user_id
SLOTS.lot_id                                 -> PARKING_LOTS.lot_id
BOOKINGS.user_id                             -> USERS.user_id
BOOKINGS.(vehicle_id, user_id)               -> VEHICLES.(vehicle_id, user_id)
BOOKINGS.slot_id                             -> SLOTS.slot_id
PAYMENTS.booking_id                          -> BOOKINGS.booking_id
REVIEWS.user_id                              -> USERS.user_id
REVIEWS.lot_id                               -> PARKING_LOTS.lot_id
BOOKING_AUDIT_LOG.booking_id                 -> BOOKINGS.booking_id
```

`PARKING_LOTS.mongo_lot_id` is unique and stores the MongoDB document `_id`, but it is not a PostgreSQL foreign key: PostgreSQL cannot enforce references into MongoDB. MongoDB's `LOT_PROFILE.pg_lot_id` has a unique index and stores the reciprocal PostgreSQL lot identifier; that cross-database association is application-managed.

### Important relational constraints

- `VEHICLES.(vehicle_id, user_id)` is a unique candidate key so a booking can reference a vehicle owned by that booking's user.
- `PAYMENTS.booking_id` is both a foreign key and unique, giving each booking at most one payment.
- `SLOTS.(lot_id, slot_label)` and `REVIEWS.(user_id, lot_id)` are unique alternate keys.
- The GiST exclusion constraint prevents overlapping held or confirmed bookings for the same slot, using half-open intervals `[start_time, end_time)`.
- Entity attributes, SQL data types, checks, deletion actions, and other implementation details are declared in [`db/postgres/01_schema.sql`](../db/postgres/01_schema.sql).

## MongoDB document collection

MongoDB does not have a relational schema or foreign-key constraints. Its `lot_profiles` collection uses a validated document structure and indexes, detailed separately in [the MongoDB document schema](13-mongodb-document-schema.md).
