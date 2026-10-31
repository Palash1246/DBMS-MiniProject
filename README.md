# ParkSmart (Book My Parking, Bengaluru)

A production-grade multi-model database application demonstrating advanced SQL (PostgreSQL 16) and NoSQL (MongoDB 7) architecture for real-time urban parking reservations in Bengaluru. Built for PES University DBMS Experiential Learning - Level 3 Project (50 Marks).

---

## 1. System Overview & Problem Statement

Urban parking in Bengaluru suffers from extreme congestion, uncoordinated slot contention, and lack of verified amenity discovery (such as EV charging, covered parking, and height clearances).

ParkSmart solves the core concurrency challenge of parking reservations:
- **Exclusion Constraints (`btree_gist`)**: Prevents any slot from being double-booked for overlapping time ranges at the database kernel level (guaranteeing 100% integrity even under concurrent HTTP requests without heavy distributed locking).
- **Multi-Model Polyglot Architecture**:
  - **PostgreSQL 16**: Relational ACID core for users, vehicles, area hierarchies, slots, temporal bookings, payments, audit logs, views, triggers, and Row-Level Security (RLS).
  - **MongoDB 7**: Flexible document store with `2dsphere` geospatial indexing for lot profiles, rich dynamic amenities, operating hours, photos, and advisory rate multipliers.

---

## 2. Prerequisites

- **Node.js**: v20+ (Node 22 LTS recommended)
- **Docker & Docker Compose**: Docker Desktop with Docker Compose v2+
- **Git**

---

## 3. Quickstart & Setup

### Step 1: Clone & Configure Environment
```bash
git clone <repo-url>
cd repo
cp .env.example .env.local
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start Databases (Docker)
```bash
npm run db:up
```
Verify PostgreSQL is accessible on port `5432` and MongoDB on port `27017`.

### Step 4: Run Database Migrations, MongoDB Setup & Seed Data
```bash
# Complete reset, schema migration, Mongo setup, and seed:
npm run db:reset
```
Or run individually:
```bash
npm run db:migrate   # Executes SQL migrations 00-07
npm run db:mongo     # Configures MongoDB schema validators, users, and 2dsphere indexes
npm run db:seed      # Seeds deterministic realistic Bengaluru lots, slots, bookings, and users
```

### Step 5: Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Demo Accounts

All seed accounts use the default password: `ChangeMe#2026`

| Role | Email | Capabilities |
|---|---|---|
| **Admin** | `admin@parksmart.test` | System stats, cross-lot analytics, user management, audit logs, reconcile tool |
| **Owner** | `owner1@parksmart.test` | Manage lots, slots, staff, profile (MongoDB), view occupancy & revenue |
| **Owner** | `owner2@parksmart.test` | Multi-lot owner (Koramangala, MG Road) |
| **Staff** | `staff1@parksmart.test` | Gate check-in / check-out by booking code, arrival queues |
| **Customer** | `cust1@parksmart.test` | Search lots by radius/amenities, hold slots, pay, cancel, manage vehicles |
| **Customer** | `cust2@parksmart.test` | EV vehicle owner |

---

## 5. Background Services & Demonstration Scripts

### Background Hold Expiry Daemon
```bash
npm run cron:expire
```
Sweeps expired holds every 60 seconds (also lazily swept at booking creation/payment).

### Concurrency Race Condition Demo
```bash
npm run demo:race
```
Proves that standard check-then-insert code produces double bookings, whereas PostgreSQL's exclusion constraint cleanly blocks race conditions.

### Cross-Database Reconciliation Script
```bash
npm run reconcile
```
Detects any orphaned PostgreSQL lots or MongoDB profiles across the polyglot persistence boundary.

### High-Volume Index Demonstration
```bash
npm run db:seed:bulk
# Run explain analyze script:
psql -U postgres -d parksmart -f scripts/explain-demo.sql
```

---

## 6. Running Tests

```bash
# Run all tests (Vitest)
npm test

# Run database constraints and RBAC tests
npm run test:db
```

---

## 7. Project Structure

```
parksmart/
├── db/
│   ├── migrate.ts                  # Sequential SQL migration runner (--reset supported)
│   ├── seed.ts                     # Deterministic seed data generator
│   ├── seed-bulk.ts                # 200k booking dataset for index benchmarks
│   ├── postgres/
│   │   ├── 00_roles_extensions.sql # btree_gist extension and database roles
│   │   ├── 01_schema.sql           # Tables, foreign keys, CHECK and EXCLUDE constraints
│   │   ├── 02_ddl_demo.sql         # Scratch schema demonstrating ALTER and DROP DDL
│   │   ├── 03_functions.sql        # Stored functions and procedures (sp_close_lot, etc.)
│   │   ├── 04_triggers.sql         # Audit logging, payment confirmation, visit integrity
│   │   ├── 05_views.sql            # Security invoker views (occupancy, revenue, peak hours)
│   │   ├── 06_indexes.sql          # Partial, composite, and GiST indexes
│   │   ├── 07_rls_grants.sql       # Row-Level Security policies and least-privilege grants
│   │   └── 99_queries.sql          # Q1 to Q14 complex query catalog
│   └── mongo/
│       ├── setup.ts                # Collection validator, strict bounds, indexes
│       └── pipelines.ts            # $geoNear and aggregation pipelines
├── scripts/
│   ├── expire-holds-loop.ts        # Automated hold expiration daemon
│   ├── race-demo.ts                # Concurrency double-booking demo
│   ├── reconcile.ts                # Cross-DB orphan integrity auditor
│   └── explain-demo.sql            # EXPLAIN (ANALYZE, BUFFERS) before/after index
├── src/
│   ├── middleware.ts               # Edge JWT route protection
│   ├── lib/                        # Singletons: pg.ts, mongo.ts, auth.ts, session.ts, env.ts
│   ├── app/                        # Next.js App Router (Public, Customer, Owner, Staff, Admin)
│   └── components/                 # Reusable UI & Leaflet Map components
├── tests/                          # Vitest suites (constraints, RBAC, mongo, concurrency, API)
└── docs/                           # Rubric documentation and architecture diagrams
```

