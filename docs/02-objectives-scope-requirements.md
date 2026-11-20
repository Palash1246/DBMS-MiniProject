# Objectives, scope, and requirements

## Objectives

- Prevent overlapping active bookings at the database layer, including concurrent requests.
- Support nearby lot discovery with amenity, vehicle, time-window, and locality filters.
- Demonstrate relational integrity, stored routines, triggers, views, indexes, transactions, and RLS.
- Use MongoDB for validated flexible lot profiles, geospatial queries, text search, and aggregation.
- Provide customer, owner, staff, and administrator workflows through Next.js.

## Scope

Included: simulated payment; customer and owner accounts; staff accounts; vehicle records; lot profiles, slots, reviews, booking lifecycle, dashboards, audit log, hold expiry, and reconciliation.

Excluded: real payment processing, surge pricing, QR generation, notifications, image upload, overstay penalties, mobile applications, multiple cities, and vector search.

## Functional requirements

| ID | Requirement | Endpoint(s) |
|---|---|---|
| FR-01 | Register as customer or owner and authenticate with an HttpOnly session cookie | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` |
| FR-02 | Find lots by coordinates, radius, locality, amenities, vehicle type, time window, or text | `/api/search`, `/api/lots/text-search`, `/api/areas` |
| FR-03 | Read lot details, reviews, and slot availability | `/api/lots/:id`, `/api/lots/:id/slots`, `/api/lots/:id/reviews` |
| FR-04 | Manage vehicles and customer bookings | `/api/vehicles`, `/api/bookings` |
| FR-05 | Pay, cancel, and view a booking | `/api/bookings/:id`, `/pay`, `/cancel` |
| FR-06 | Create lots with PostgreSQL/MongoDB dual write and manage profiles | `/api/owner/lots`, `/profile` |
| FR-07 | Manage spaces and assigned gate staff | `/api/owner/lots/:id/slots`, `/staff` |
| FR-08 | Close a lot and view owner dashboards | `/api/owner/lots/:id/close`, `/api/owner/dashboard/*` |
| FR-09 | Check vehicles in and out | `/api/staff/checkin`, `/api/staff/checkout` |
| FR-10 | Review system users, audit, analytics, and cross-database consistency | `/api/admin/*` |
| FR-11 | Expire holds using a protected scheduler endpoint | `/api/internal/expire-holds` |

## Roles

Customers search and book; owners manage their own lots; staff operate assigned gates; administrators inspect and manage system data. PostgreSQL roles and RLS enforce data boundaries in addition to API role checks.
