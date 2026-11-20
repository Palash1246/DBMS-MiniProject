# Query catalog and observed results

The runnable PostgreSQL statements Q1–Q14 are in `db/postgres/99_queries.sql`. They demonstrate joins, `HAVING`, nested and correlated queries, recursion, window functions, anti-joins, `DISTINCT ON`, `EXCEPT`, aggregates, `UPDATE`, guarded `DELETE`, and `INSERT ... SELECT`.

`npx tsx scripts/query-catalog-smoke.ts` executed all 14 statements against the local seeded database on 2026-11-12. It ran inside one transaction and rolled back the DML demonstrations. Q4's correlated predicate was tested on a bounded 101-booking outer sample because the full correlated query is expensive on the separate 200,000-row performance fixture.

| Query | Result rows / affected rows |
|---|---:|
| Q1 | 50 |
| Q2 | 14 |
| Q3 | 40,141 |
| Q4 | 86 (bounded sample) |
| Q5 | 19 |
| Q6 | 15 |
| Q7 | 1 |
| Q8 | 14 |
| Q9 | 0 |
| Q10 | 11 |
| Q11 | 0 |
| Q12 | 0 updated |
| Q13 | 1 deleted, rolled back |
| Q14 | 3 inserted, rolled back |

MongoDB pipelines are exported from `db/mongo/pipelines.ts`: nearby geospatial search with a results/amenity-count/total facet, and amenity coverage grouped by locality. `GET /api/search` combines nearby profiles with PostgreSQL availability; `GET /api/admin/analytics/amenity-coverage` runs the aggregation. `tests/mongo.test.ts` verifies both pipelines against the seeded database and a temporary profile fixture.
