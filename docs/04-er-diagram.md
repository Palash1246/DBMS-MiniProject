# Entity-relationship diagram

The project ER diagram follows the course slides' **Chen notation**: entity sets are rectangles, relationship sets are diamonds, attributes are ovals, key attributes are underlined, and `1`/`N` marks the relationship cardinality. Open the editable diagram in diagrams.net using [parksmart-er-diagram.drawio](parksmart-er-diagram.drawio).

The model includes PostgreSQL's transactional entities and MongoDB's `LOT_PROFILE` document as one logical model. The `HAS_PROFILE` association is a cross-database one-to-one link: PostgreSQL stores the MongoDB ObjectId in `PARKING_LOTS.mongo_lot_id`; MongoDB stores the corresponding PostgreSQL id in the unique-indexed `LOT_PROFILE.pg_lot_id`. Neither database can enforce a foreign key across this boundary. The association is maintained by application logic and checked by the admin reconciliation endpoint.

## Entity sets and key attributes

| Entity set | Underlined key attribute(s) | Other attributes represented in the schema |
|---|---|---|
| `AREAS` | `area_id` | `name`, `level` |
| `USERS` | `user_id` | `name`, `email`, `phone`, `password_hash`, `role`, `created_at` |
| `VEHICLES` | `vehicle_id` | `reg_number`, `vehicle_type` |
| `PARKING_LOTS` | `lot_id` | `name`, `mongo_lot_id`, `base_rate_per_hr`, `is_active`, `created_at` |
| `SLOTS` | `slot_id` | `slot_label`, `slot_type`, `status` |
| `BOOKINGS` | `booking_id` | `booking_code`, `start_time`, `end_time`, `status`, `amount`, `expires_at`, `created_at`, `checked_in_at`, `checked_out_at` |
| `PAYMENTS` | `payment_id` | `amount`, `method`, `status`, `paid_at`, `created_at` |
| `REVIEWS` | `review_id` | `rating`, `comment`, `created_at` |
| `BOOKING_AUDIT_LOG` | `log_id` | `old_status`, `new_status`, `changed_by`, `changed_at` |
| `LOT_PROFILE` (MongoDB document) | `_id` | `pg_lot_id`, `name`, `description`, `location`, `address`, `amenities`, `vehicle_types_allowed`, `height_limit_m`, `operating_hours`, `photos`, `pricing_rules`, `updated_at` |

`LOT_STAFF` is the mapped relation for the many-to-many `ASSIGNED_TO` relationship. Its `assigned_at` attribute belongs to the relationship, not to either participating entity.

## Relationship sets and participation

| Relationship set | Entity sets | Chen ratio | Min-max participation and meaning |
|---|---|---|---|
| `PARENT_OF` | `AREAS` to `AREAS` | 1:N | Parent role `(0,N)`; child role `(0,1)` overall. A city has no parent; every non-city area has exactly one. |
| `LOCATES` | `AREAS` to `PARKING_LOTS` | 1:N | Area `(0,N)`; lot `(1,1)`. Each lot references one area; some areas may have no lots. |
| `OWNS_VEHICLE` | `USERS` to `VEHICLES` | 1:N | User `(0,N)`; vehicle `(1,1)`. |
| `OWNS_LOT` | `USERS` to `PARKING_LOTS` | 1:N | User `(0,N)`; lot `(1,1)`. |
| `ASSIGNED_TO` | `USERS` to `PARKING_LOTS` | M:N | User `(0,N)`; lot `(0,N)`. Staff can serve multiple lots and lots can have multiple staff; relationship attribute: `assigned_at`. |
| `CONTAINS` | `PARKING_LOTS` to `SLOTS` | 1:N | Lot `(0,N)`; slot `(1,1)`. |
| `MAKES` | `USERS` to `BOOKINGS` | 1:N | User `(0,N)`; booking `(1,1)`. |
| `USES` | `VEHICLES` to `BOOKINGS` | 1:N | Vehicle `(0,N)`; booking `(1,1)`. A composite FK ensures the vehicle belongs to the booking user. |
| `RESERVES` | `SLOTS` to `BOOKINGS` | 1:N | Slot `(0,N)`; booking `(1,1)`. Active intervals for a slot cannot overlap. |
| `HAS_PAYMENT` | `BOOKINGS` to `PAYMENTS` | 1:1 | Booking `(0,1)`; payment `(1,1)`. |
| `HAS_HISTORY` | `BOOKINGS` to `BOOKING_AUDIT_LOG` | 1:N | Booking `(1,N)` under the insert/status trigger; audit event `(1,1)`. |
| `WRITES` | `USERS` to `REVIEWS` | 1:N | User `(0,N)`; review `(1,1)`. |
| `ABOUT` | `PARKING_LOTS` to `REVIEWS` | 1:N | Lot `(0,N)`; review `(1,1)`. One review per user and lot. |
| `HAS_PROFILE` | `PARKING_LOTS` to `LOT_PROFILE` | 1:1 | Intended `(1,1)` on both sides in the application; cross-database enforcement is not available. |

The first diagram page shows the relationship overview; the second page shows entity attributes. The complete mapped relations appear in [the relational schema](05-relational-schema.md), and MongoDB's nested document shape appears in [the MongoDB document schema](13-mongodb-document-schema.md).

## Course notation applied

- A strong entity set uses a single rectangle; a relationship set uses a diamond.
- Attributes use ovals, and key attributes are underlined. Composite keys underline every participating attribute.
- MongoDB array attributes are shown with double ovals; embedded objects are documented as composite fields in the document schema.
- A relationship attribute is attached to its relationship set.
- `1:N`, `M:N`, and `1:1` denote the slides' Chen cardinality ratios. The overview keeps connectors single for legibility; mandatory participation is stated in the relationship table above.
- MongoDB arrays and embedded objects remain document fields; they are not converted into relational tables unless the relational model requires a separate relation.
