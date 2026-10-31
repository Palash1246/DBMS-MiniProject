-- 05_views.sql
-- Views with security_invoker = true to respect calling role's RLS policies.

-- 1. Real-time Lot Occupancy View
CREATE OR REPLACE VIEW v_lot_occupancy WITH (security_invoker = true) AS
SELECT
  l.lot_id,
  l.name AS lot_name,
  a.name AS locality_name,
  COUNT(s.slot_id) AS total_slots,
  COUNT(s.slot_id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.slot_id = s.slot_id
        AND b.status = 'confirmed'
        AND now() >= b.start_time AND now() < b.end_time
    )
  ) AS occupied_slots,
  ROUND(
    (COUNT(s.slot_id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.slot_id = s.slot_id
          AND b.status = 'confirmed'
          AND now() >= b.start_time AND now() < b.end_time
      )
    )::numeric / NULLIF(COUNT(s.slot_id), 0)) * 100.0,
    1
  ) AS occupancy_pct
FROM parking_lots l
JOIN areas a ON a.area_id = l.area_id
LEFT JOIN slots s ON s.lot_id = l.lot_id AND s.status = 'active'
WHERE l.is_active
GROUP BY l.lot_id, l.name, a.name;

-- 2. Owner Daily Revenue Breakdown View
CREATE OR REPLACE VIEW v_owner_revenue WITH (security_invoker = true) AS
SELECT
  l.lot_id,
  l.owner_id,
  l.name AS lot_name,
  (p.paid_at AT TIME ZONE 'Asia/Kolkata')::date AS revenue_date,
  COUNT(p.payment_id) FILTER (WHERE p.status = 'success') AS bookings_paid,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'success'), 0.00)::numeric(10,2) AS total_revenue,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'refunded'), 0.00)::numeric(10,2) AS total_refunded
FROM parking_lots l
JOIN slots s ON s.lot_id = l.lot_id
JOIN bookings b ON b.slot_id = s.slot_id
JOIN payments p ON p.booking_id = b.booking_id
WHERE p.paid_at IS NOT NULL
GROUP BY l.lot_id, l.owner_id, l.name, (p.paid_at AT TIME ZONE 'Asia/Kolkata')::date;

-- 3. Peak Parking Hours View (IST Hours 0-23)
CREATE OR REPLACE VIEW v_peak_hours WITH (security_invoker = true) AS
SELECT
  s.lot_id,
  l.name AS lot_name,
  EXTRACT(HOUR FROM b.start_time AT TIME ZONE 'Asia/Kolkata')::int AS hour_of_day,
  COUNT(b.booking_id) AS booking_count
FROM bookings b
JOIN slots s ON s.slot_id = b.slot_id
JOIN parking_lots l ON l.lot_id = s.lot_id
WHERE b.status IN ('confirmed', 'completed')
GROUP BY s.lot_id, l.name, EXTRACT(HOUR FROM b.start_time AT TIME ZONE 'Asia/Kolkata');

-- 4. Unified Bookings View (Used by Customer, Owner, and Staff)
CREATE OR REPLACE VIEW v_my_bookings WITH (security_invoker = true) AS
SELECT
  b.booking_id,
  b.booking_code,
  b.user_id,
  b.vehicle_id,
  v.reg_number,
  v.vehicle_type,
  b.slot_id,
  s.slot_label,
  s.slot_type,
  l.lot_id,
  l.name AS lot_name,
  l.owner_id,
  a.name AS locality_name,
  b.start_time,
  b.end_time,
  b.status AS booking_status,
  b.amount,
  b.expires_at,
  b.checked_in_at,
  b.checked_out_at,
  b.created_at,
  p.payment_id,
  p.status AS payment_status,
  p.method AS payment_method,
  p.paid_at
FROM bookings b
JOIN slots s ON s.slot_id = b.slot_id
JOIN parking_lots l ON l.lot_id = s.lot_id
JOIN areas a ON a.area_id = l.area_id
JOIN vehicles v ON v.vehicle_id = b.vehicle_id
LEFT JOIN payments p ON p.booking_id = b.booking_id;

