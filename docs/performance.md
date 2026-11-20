# Performance demonstration

## Environment and data

- PostgreSQL 16.15, Docker image `postgres:16-alpine`.
- No CPU or memory limit was configured for the container; host hardware was not recorded.
- `npm run db:seed` created the fictional demo dataset; `npm run db:seed:bulk` added 200,000 completed bookings. The query ran with 200,700 booking rows.
- Command: `Get-Content scripts/explain-demo.sql -Raw | docker exec -i parksmart-postgres-fresh psql -U postgres -d parksmart`.

## Query measured

```sql
SELECT booking_id, start_time, end_time
FROM bookings
WHERE status = 'completed' AND slot_id = 1
ORDER BY start_time DESC
LIMIT 50;
```

## Actual plans

Before `idx_bookings_completed_slot_start`, PostgreSQL used a parallel sequential scan and top-N sort:

```text
Limit (actual time=25.285..29.074 rows=50 loops=1)
  -> Gather Merge (actual time=25.283..29.068 rows=50 loops=1)
       Workers Planned: 1
       Workers Launched: 1
       -> Sort (actual time=19.614..19.618 rows=38 loops=2)
            Sort Method: top-N heapsort  Memory: 30kB
            -> Parallel Seq Scan on bookings
                 (actual time=0.118..19.315 rows=446 loops=2)
                 Rows Removed by Filter: 99904
Planning Time: 7.332 ms
Execution Time: 29.810 ms
```

After creating the partial index on `(slot_id, start_time DESC) WHERE status='completed'` and running `ANALYZE`, PostgreSQL used an index scan:

```text
Limit (actual time=0.053..0.110 rows=50 loops=1)
  -> Index Scan using idx_bookings_completed_slot_start
       (actual time=0.052..0.107 rows=50 loops=1)
       Index Cond: (slot_id = 1)
Planning Time: 0.652 ms
Execution Time: 0.136 ms
```

This run measured 29.810 ms before and 0.136 ms after. Treat these as local demonstration timings, not a benchmark: they depend on cache state, container scheduling, and host hardware, which was not recorded. The script drops the demonstration index before measuring so it can be rerun and reproduce both plan shapes.
