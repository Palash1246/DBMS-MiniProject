# Architecture

```mermaid
flowchart LR
  Browser[Browser: Next.js pages] -->|JSON + HttpOnly JWT cookie| API[Next.js Route Handlers]
  API -->|withDb: transaction, SET LOCAL ROLE, RLS| PG[(PostgreSQL 16)]
  API -->|Mongo driver, least privilege| MDB[(MongoDB 7 lot_profiles)]
  Scheduler[Expiry loop every 60 seconds] -->|secret protected POST| API
  PG -->|constraints, functions, triggers, views| PG
```

Booking path: browser submits a time window and selected slot; the API validates the body and role; `withDb` establishes the caller identity; `sp_create_booking` computes the price and creates the hold; the temporal exclusion constraint rejects overlap; the response includes booking code and expiry; payment simulation updates a payment row and a trigger confirms the booking.

Authorization layers: JWT/path check in edge middleware; `requireRole` or API session check in route handlers; fixed PostgreSQL role mapping and RLS in the database. Admin scripts connect with admin credentials and are not imported by the application server.
