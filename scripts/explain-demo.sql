DROP INDEX IF EXISTS idx_bookings_completed_slot_start;

\echo 'Before the supporting index'
EXPLAIN (ANALYZE, BUFFERS)
SELECT booking_id, start_time, end_time
FROM bookings
WHERE status = 'completed' AND slot_id = 1
ORDER BY start_time DESC
LIMIT 50;

CREATE INDEX IF NOT EXISTS idx_bookings_completed_slot_start
  ON bookings (slot_id, start_time DESC) WHERE status = 'completed';
ANALYZE bookings;

\echo 'After the supporting index'
EXPLAIN (ANALYZE, BUFFERS)
SELECT booking_id, start_time, end_time
FROM bookings
WHERE status = 'completed' AND slot_id = 1
ORDER BY start_time DESC
LIMIT 50;
