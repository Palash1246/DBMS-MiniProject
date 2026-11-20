# Data dictionary

The PostgreSQL schema is declared in `db/postgres/01_schema.sql`. This summary lists each entity and its key role; the SQL file remains authoritative for exact types and checks.

## PostgreSQL columns

| Table | Column | Type / nullability | Key or rule | Meaning |
|---|---|---|---|---|
| areas | area_id | SERIAL NOT NULL | PK | Area identifier |
| areas | name | VARCHAR(80) NOT NULL | Unique with parent | City, zone, or locality name |
| areas | level | VARCHAR(10) NOT NULL | city/zone/locality check | Hierarchy level |
| areas | parent_area_id | INT NULL | Self FK, RESTRICT | Parent area; null only for city |
| users | user_id | SERIAL NOT NULL | PK | User identifier |
| users | name | VARCHAR(100) NOT NULL | At least 2 trimmed characters | Display name |
| users | email | VARCHAR(150) NOT NULL | UQ, lowercase, email pattern | Login email |
| users | phone | VARCHAR(15) NOT NULL | UQ, phone pattern | Contact number |
| users | password_hash | VARCHAR(255) NOT NULL | Not readable by customer/owner/staff roles | bcrypt password hash |
| users | role | VARCHAR(10) NOT NULL | customer/owner/staff/admin | One account role |
| users | created_at | TIMESTAMPTZ NOT NULL | Default now() | Account creation time |
| vehicles | vehicle_id | SERIAL NOT NULL | PK; composite UQ with user_id | Vehicle identifier |
| vehicles | user_id | INT NOT NULL | FK users, CASCADE | Vehicle owner |
| vehicles | reg_number | VARCHAR(15) NOT NULL | UQ, registration pattern | Vehicle registration |
| vehicles | vehicle_type | VARCHAR(10) NOT NULL | car/bike/ev | Vehicle category |
| parking_lots | lot_id | SERIAL NOT NULL | PK | Lot identifier |
| parking_lots | owner_id | INT NOT NULL | FK users, RESTRICT | Lot owner |
| parking_lots | area_id | INT NOT NULL | FK areas | Locality for the lot |
| parking_lots | name | VARCHAR(120) NOT NULL | Unique per owner | Lot display name |
| parking_lots | mongo_lot_id | CHAR(24) NOT NULL | UQ, hex ObjectId check | MongoDB profile identifier |
| parking_lots | base_rate_per_hr | NUMERIC(8,2) NOT NULL | Positive | Base hourly price |
| parking_lots | is_active | BOOLEAN NOT NULL | Default true | Whether customers can book |
| parking_lots | created_at | TIMESTAMPTZ NOT NULL | Default now() | Lot creation time |
| lot_staff | lot_id | INT NOT NULL | Composite PK; FK parking_lots, CASCADE | Assigned lot |
| lot_staff | user_id | INT NOT NULL | Composite PK; FK users, CASCADE | Staff account |
| lot_staff | assigned_at | TIMESTAMPTZ NOT NULL | Default now() | Assignment time |
| slots | slot_id | SERIAL NOT NULL | PK | Space identifier |
| slots | lot_id | INT NOT NULL | FK parking_lots, CASCADE | Parent lot |
| slots | slot_label | VARCHAR(10) NOT NULL | Unique per lot | Signage label |
| slots | slot_type | VARCHAR(10) NOT NULL | regular/ev/disabled | Space category |
| slots | status | VARCHAR(12) NOT NULL | active/maintenance | Bookability status |
| bookings | booking_id | SERIAL NOT NULL | PK | Booking identifier |
| bookings | booking_code | CHAR(8) NOT NULL | UQ, generated | Human-readable gate code |
| bookings | user_id | INT NOT NULL | FK users | Customer account |
| bookings | vehicle_id | INT NOT NULL | Composite FK with user_id | Customer-owned vehicle |
| bookings | slot_id | INT NOT NULL | FK slots | Reserved parking space |
| bookings | start_time | TIMESTAMPTZ NOT NULL | Before end_time | Reservation start |
| bookings | end_time | TIMESTAMPTZ NOT NULL | Max 24 hours from start | Reservation end |
| bookings | status | VARCHAR(10) NOT NULL | held/confirmed/cancelled/expired/completed | Lifecycle state |
| bookings | amount | NUMERIC(10,2) NOT NULL | Nonnegative | PostgreSQL-calculated billed amount |
| bookings | expires_at | TIMESTAMPTZ NULL | Required while held | Hold expiry time |
| bookings | created_at | TIMESTAMPTZ NOT NULL | Default now() | Booking creation time |
| bookings | checked_in_at | TIMESTAMPTZ NULL | Checkout requires check-in | Gate arrival time |
| bookings | checked_out_at | TIMESTAMPTZ NULL | At or after check-in | Gate departure time |
| payments | payment_id | SERIAL NOT NULL | PK | Payment record identifier |
| payments | booking_id | INT NOT NULL | UQ, FK bookings RESTRICT | Booking paid |
| payments | amount | NUMERIC(10,2) NOT NULL | Nonnegative | Simulated payment amount |
| payments | method | VARCHAR(10) NULL | upi/card/wallet | Simulated payment method |
| payments | status | VARCHAR(10) NOT NULL | pending/success/failed/refunded | Payment state |
| payments | paid_at | TIMESTAMPTZ NULL | Present iff success/refunded | Payment/refund timestamp |
| payments | created_at | TIMESTAMPTZ NOT NULL | Default now() | Payment row creation time |
| reviews | review_id | SERIAL NOT NULL | PK | Review identifier |
| reviews | user_id | INT NOT NULL | FK users, CASCADE | Reviewer |
| reviews | lot_id | INT NOT NULL | FK parking_lots, CASCADE | Reviewed lot |
| reviews | rating | SMALLINT NOT NULL | 1-5 | Star rating |
| reviews | comment | TEXT NULL | At most 1000 characters | Review text |
| reviews | created_at | TIMESTAMPTZ NOT NULL | Default now() | Review creation time |
| booking_audit_log | log_id | BIGSERIAL NOT NULL | PK | Audit row identifier |
| booking_audit_log | booking_id | INT NOT NULL | FK bookings RESTRICT | Booking whose state changed |
| booking_audit_log | old_status | VARCHAR(10) NULL | Null for initial insert | Previous state |
| booking_audit_log | new_status | VARCHAR(10) NOT NULL | Trigger written | New state |
| booking_audit_log | changed_by | INT NULL | Session actor when available | User causing the transition |
| booking_audit_log | changed_at | TIMESTAMPTZ NOT NULL | Default now() | Transition time |

| Table | Primary key | Important columns and constraints |
|---|---|---|
| `areas` | `area_id` | `name`, `level`, self-FK `parent_area_id`; city/zone/locality hierarchy |
| `users` | `user_id` | unique lowercase `email`, unique `phone`, `password_hash`, single `role` |
| `vehicles` | `vehicle_id` | owner FK, unique registration, vehicle type; composite unique `(vehicle_id,user_id)` |
| `parking_lots` | `lot_id` | owner and area FKs, Mongo ObjectId, positive base rate, active flag |
| `lot_staff` | `(lot_id,user_id)` | assignment bridge between lot and staff account |
| `slots` | `slot_id` | lot FK, unique lot label, type and maintenance status |
| `bookings` | `booking_id` | user, own vehicle, slot, half-open interval, status, billed amount, expiry and gate timestamps |
| `payments` | `payment_id` | one payment per booking, amount, method, status, paid timestamp |
| `reviews` | `review_id` | user and lot FKs, rating 1-5, one review per user/lot |
| `booking_audit_log` | `log_id` | booking FK with RESTRICT, old/new status, actor and timestamp; immutable |

## MongoDB `lot_profiles`

| Field | Type | Meaning |
|---|---|---|
| `_id` | ObjectId | Equals PostgreSQL `mongo_lot_id` |
| `pg_lot_id` | number | PostgreSQL lot key; unique indexed link |
| `name`, `description` | string | Search and display copy |
| `location` | GeoJSON Point | Coordinates are `[longitude, latitude]` |
| `address` | object | Street, copied locality name, Bengaluru pincode |
| `amenities` | string array | Validated facility tags |
| `vehicle_types_allowed` | string array | Supported vehicle classes |
| `height_limit_m` | number | Optional clearance |
| `operating_hours` | object | Open all day or opening/closing time |
| `photos` | object array | URL and caption; no upload |
| `pricing_rules` | object array | Advisory day/hour multipliers |
| `updated_at` | date | Last profile edit |
