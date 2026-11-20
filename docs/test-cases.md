# Manual test cases

Record only observed outcomes. Fill Actual, Pass/Fail, and screenshot after running the app against seeded databases.

| ID | Scenario | Expected | Actual | Pass/Fail | Screenshot |
|---|---|---|---|---|---|
| TC-01 | Register customer | 201, can log in | API smoke: register 201, login 200, session cookie set | Pass (API) | TODO(team) |
| TC-02 | Register duplicate email/phone | 409 duplicate | API smoke: duplicate email returned 409 | Pass (API) | TODO(team) |
| TC-03 | Invalid registration values | 400 validation | API smoke: invalid fields returned 400 | Pass (API) | TODO(team) |
| TC-04 | Wrong password | 401 generic message | TODO(team) | TODO(team) | TODO(team) |
| TC-05 | Customer opens owner page | Redirect/403 | Authenticated customer redirected from `/owner/dashboard` with 307 to `/` | Pass (API) | TODO(team) |
| TC-06 | Invalid vehicle registration | Rejected | Live API returned 400 `VALIDATION` for `BAD` | Pass (API) | TODO(team) |
| TC-07 | Search with multiple amenities | Matching lots, nearest first | `covered,cctv` filter returned 3 lots with HTTP 200 | Pass (API) | TODO(team) |
| TC-08 | Search a parent area | Descendant localities included | TODO(team) | TODO(team) | TODO(team) |
| TC-09 | Hold available space | 201 with expiry/code | Live API returned 201 for a free regular slot; DB suite also checked booking code/expiry and pending payment | Pass (API + DB) | TODO(team) |
| TC-10 | Overlapping hold by another user | 409 SLOT_TAKEN | 20 concurrent DB calls: 1 accepted, 19 rejected with SQLSTATE 23P01 | Pass (DB; HTTP mapping not separately exercised) | TODO(team) |
| TC-11 | Back-to-back holds | Both accepted | `db.constraints.test.ts`: `[)` adjacent ranges accepted | Pass (DB) | TODO(team) |
| TC-12 | Regular vehicle chooses EV-only space | Rejected | TODO(team) | TODO(team) | TODO(team) |
| TC-13 | Pay a hold | Confirmed and audited | Live API retry returned `CONFIRMED`; DB suite verified payment trigger and audit row | Pass (API + DB) | TODO(team) |
| TC-14 | Simulated payment failure, retry | Failed then confirmed | Live API returned 402 `PAYMENT_FAILED`, then 200 `CONFIRMED` on retry | Pass (API) | TODO(team) |
| TC-15 | Pay expired hold | 410 HOLD_EXPIRED | Live API returned 410 `HOLD_EXPIRED` after the test hold expiry was moved into the past | Pass (API) | TODO(team) |
| TC-16 | Cancel over 60 minutes before start | Refunded | Live API returned `CANCELLED_REFUNDED` for a booking 4 hours ahead | Pass (API) | TODO(team) |
| TC-17 | Cancel within 60 minutes | No refund | Live API returned `CANCELLED_NO_REFUND` for a booking starting in 35 minutes | Pass (API) | TODO(team) |
| TC-18 | Review without completed visit | Rejected | `db.logic.test.ts`: review trigger rejected review without a completed visit | Pass (DB) | TODO(team) |
| TC-19 | Owner creates a lot | SQL and Mongo identifiers match | Live owner API created a temporary lot and Mongo profile; reconciliation showed no orphan | Pass (API) | TODO(team) |
| TC-20 | Mongo unavailable during lot creation | SQL insert rolled back | TODO(team) | TODO(team) | TODO(team) |
| TC-21 | Owner edits another owner's lot | 403 | TODO(team) | TODO(team) | TODO(team) |
| TC-22 | Generate 20 slots | 20 unique rows | Live owner API generated and listed 20 unique slots | Pass (API) | TODO(team) |
| TC-23 | Close lot with future bookings | Cancel/refund and deactivate | Live API closed a temporary lot with no bookings (`cancelled=0`); future-booking cancellation/refund path remains TODO | Partial (API) | TODO(team) |
| TC-24 | Staff checks in during allowed window | Checked in | `db.logic.test.ts`: check-in/out routine completed the visit | Pass (DB) | TODO(team) |
| TC-25 | Staff checks in too early | TOO_EARLY | TODO(team) | TODO(team) | TODO(team) |
| TC-26 | Staff uses unassigned lot code | Forbidden/not found | TODO(team) | TODO(team) | TODO(team) |
| TC-27 | Staff checks out | Completed | `db.logic.test.ts`: check-out routine completed the visit | Pass (DB) | TODO(team) |
| TC-28 | Update audit row | AUDIT_IMMUTABLE | `db.logic.test.ts`: audit table rejected UPDATE and DELETE | Pass (DB) | TODO(team) |
| TC-29 | Invalid Mongo amenity | Validator rejects | `mongo.test.ts`: MongoDB rejected an unknown amenity with validator code 121 | Pass (Mongo) | TODO(team) |
| TC-30 | Admin deletes lot with bookings | Blocked; empty lot removable | Live admin API deleted a temporary lot with no bookings; booked-lot protection remains TODO | Partial (API) | TODO(team) |
| TC-31 | Reconcile after profile removal | Orphan listed | TODO(team) | TODO(team) | TODO(team) |
| TC-32 | 20 concurrent same-slot requests | One success, 19 conflicts | `concurrency.test.ts`: one accepted, 19 exclusion conflicts; different slots all accepted | Pass (DB) | TODO(team) |
