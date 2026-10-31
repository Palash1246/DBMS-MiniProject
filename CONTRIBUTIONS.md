# Team Contributions & Responsibilities (DBMS Level 3 Project)

**Project Title:** ParkSmart: Smart Urban Parking Reservation System for Bengaluru  
**Institution:** PES University, Department of Computer Science and Engineering  
**Course:** Database Management Systems (Experiential Learning Level 3)  

---

## Team Division of Responsibilities

Per Section 12 of the project specification, responsibilities are split between two members covering distinct database and application domains:

| Domain | Member A (Booking Domain) | Member B (Supply Domain) |
|---|---|---|
| **Student Details** | *Name / SRN (To be updated)* | *Name / SRN (To be updated)* |
| **PostgreSQL Schema** | `users`, `vehicles`, `bookings`, `payments`, `booking_audit_log` | `areas`, `parking_lots`, `slots`, `lot_staff`, `reviews` |
| **Database Constraints** | Temporal exclusion constraint (`btree_gist` on `[start_time, end_time)`), composite foreign keys (`vehicle_id, user_id`), check constraints | Self-referencing recursive hierarchy (`areas`), unique compound keys, capacity & locality constraints |
| **Stored Logic & Triggers** | `sp_create_booking`, `sp_pay_booking`, `sp_cancel_booking`, `expire_stale_holds()`, `trg_bookings_audit`, `trg_payment_confirms_booking`, `trg_audit_immutable` | `sp_check_in`, `sp_check_out`, `sp_close_lot`, `sp_create_staff`, `fn_lots_availability`, `fn_slot_grid`, `trg_review_requires_visit`, `trg_lot_integrity` |
| **Views & Queries** | `v_my_bookings`, Q1 (multi-table join), Q3 (nested subquery), Q4 (correlated subquery), Q9 (EXISTS) | `v_lot_occupancy`, `v_owner_revenue`, `v_peak_hours`, Q5 (recursive CTE), Q6 (window functions), Q8, Q10, Q11 |
| **Row-Level Security** | Customer policies, session configuration (`app.user_id`, `app.role`), sequence grants | Owner, Staff, and Admin policies, least-privilege role matrix (`ps_customer`, `ps_lot_owner`, `ps_staff`, `ps_admin`) |
| **MongoDB Integration** | Profile query integration in booking flow | MongoDB setup (`setup.ts`), schema validator, `2dsphere` indexes, dual-write consistency, reconcile tool |
| **Next.js & API Routes** | Auth API (`/api/auth/*`), Vehicles (`/api/vehicles`), Bookings (`/api/bookings/*`), Reviews API, hold expiration daemon | Search API (`/api/search`), Lots API (`/api/lots/*`), Owner dashboard & slot management (`/api/owner/*`), Staff gate check-in (`/api/staff/*`), Admin stats |
| **Frontend UI** | Auth pages (`/login`, `/register`), Vehicle management, Booking countdown & payment, Booking history | Search & Leaflet map view, Lot detail with slot grid, Owner analytics dashboards (Recharts), Staff check-in terminal, Admin console |
| **Testing & Evaluation** | Database constraints test, Concurrency test (`concurrency.test.ts`), Race condition demo (`race-demo.ts`) | RBAC test (`db.rbac.test.ts`), MongoDB tests (`mongo.test.ts`), API integration test (`api.test.ts`) |

---

## Commit Log Highlights

*(Team members should link their git commit hashes here corresponding to their assigned domains)*

- **Member A**:
  - `feat(db): implement core booking schema and GiST temporal exclusion constraint`
  - `feat(db): stored functions for booking creation, payment simulation, and auto-expiration`
  - `feat(auth): JWT authentication, session handling, and customer vehicle/booking APIs`
  - `test(concurrency): 20 concurrent reservation race condition test verification`

- **Member B**:
  - `feat(db): hierarchical areas recursive CTE, parking lots, and slots schema`
  - `feat(mongo): lot_profiles collection schema validation and 2dsphere geospatial index`
  - `feat(db): row-level security policies, PostgreSQL roles, and security invoker views`
  - `feat(ui): interactive Leaflet search map, lot slot-grid selector, and owner analytics`

