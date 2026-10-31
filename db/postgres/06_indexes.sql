-- 06_indexes.sql
-- Performance indexes: partial, composite, and foreign key indexes.

CREATE INDEX idx_bookings_user_start  ON bookings (user_id, start_time DESC);
CREATE INDEX idx_bookings_slot_active ON bookings (slot_id, start_time) WHERE status IN ('held','confirmed');
CREATE INDEX idx_bookings_held_expiry ON bookings (expires_at) WHERE status = 'held';
CREATE INDEX idx_slots_lot            ON slots (lot_id);
CREATE INDEX idx_lots_area            ON parking_lots (area_id) WHERE is_active;
CREATE INDEX idx_reviews_lot          ON reviews (lot_id);
CREATE INDEX idx_audit_booking        ON booking_audit_log (booking_id, changed_at);
CREATE INDEX idx_areas_parent         ON areas (parent_area_id);

