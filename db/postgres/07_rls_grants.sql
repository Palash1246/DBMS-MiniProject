-- 07_rls_grants.sql
-- Least-Privilege Grants and Row-Level Security (RLS) Policies.

-- 1. Baseline Revocations from PUBLIC
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- 2. Schema USAGE
GRANT USAGE ON SCHEMA public TO ps_customer, ps_lot_owner, ps_staff, ps_admin, ps_app;

-- 3. Sequence Permissions (for tables with direct INSERT)
GRANT USAGE, SELECT ON SEQUENCE users_user_id_seq TO ps_customer, ps_lot_owner, ps_admin, ps_app;
GRANT USAGE, SELECT ON SEQUENCE vehicles_vehicle_id_seq TO ps_customer, ps_admin;
GRANT USAGE, SELECT ON SEQUENCE parking_lots_lot_id_seq TO ps_lot_owner, ps_admin;
GRANT USAGE, SELECT ON SEQUENCE slots_slot_id_seq TO ps_lot_owner, ps_admin;
GRANT USAGE, SELECT ON SEQUENCE reviews_review_id_seq TO ps_customer, ps_admin;
GRANT USAGE, SELECT ON SEQUENCE areas_area_id_seq TO ps_admin;
GRANT USAGE, SELECT ON SEQUENCE bookings_booking_id_seq TO ps_customer;
GRANT USAGE, SELECT ON SEQUENCE payments_payment_id_seq TO ps_customer;
GRANT USAGE, SELECT ON SEQUENCE booking_audit_log_log_id_seq TO ps_customer, ps_lot_owner, ps_staff, ps_admin;

-- 4. Enable Row-Level Security on All Core Tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Table Grants & Policies

-- AREAS
GRANT SELECT ON areas TO ps_customer, ps_lot_owner, ps_staff, ps_admin;
GRANT INSERT, UPDATE, DELETE ON areas TO ps_admin;

-- USERS
GRANT SELECT (user_id, name, email, phone, role, created_at) ON users TO ps_customer, ps_lot_owner, ps_staff;
GRANT UPDATE (name, phone) ON users TO ps_customer, ps_lot_owner, ps_staff;
GRANT SELECT ON users TO ps_admin;
GRANT UPDATE (role) ON users TO ps_admin;

CREATE POLICY users_customer_sel ON users FOR SELECT TO ps_customer USING (user_id = app_user_id());
CREATE POLICY users_customer_upd ON users FOR UPDATE TO ps_customer USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
CREATE POLICY users_owner_sel ON users FOR SELECT TO ps_lot_owner USING (user_id = app_user_id() OR fn_is_my_staff(user_id));
CREATE POLICY users_owner_upd ON users FOR UPDATE TO ps_lot_owner USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
CREATE POLICY users_staff_sel ON users FOR SELECT TO ps_staff USING (user_id = app_user_id());
CREATE POLICY users_staff_upd ON users FOR UPDATE TO ps_staff USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
CREATE POLICY users_admin_all ON users FOR ALL TO ps_admin USING (true) WITH CHECK (true);

-- VEHICLES
GRANT SELECT, INSERT, UPDATE, DELETE ON vehicles TO ps_customer;
GRANT SELECT ON vehicles TO ps_lot_owner, ps_staff, ps_admin;

CREATE POLICY vehicles_customer_all ON vehicles FOR ALL TO ps_customer
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
CREATE POLICY vehicles_staff_owner_sel ON vehicles FOR SELECT TO ps_staff, ps_lot_owner
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.vehicle_id = vehicles.vehicle_id));
CREATE POLICY vehicles_admin_all ON vehicles FOR ALL TO ps_admin USING (true) WITH CHECK (true);

-- PARKING_LOTS
GRANT SELECT ON parking_lots TO ps_customer, ps_staff;
GRANT SELECT, INSERT, UPDATE ON parking_lots TO ps_lot_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_lots TO ps_admin;

CREATE POLICY lots_customer_sel ON parking_lots FOR SELECT TO ps_customer USING (is_active);
CREATE POLICY lots_staff_sel ON parking_lots FOR SELECT TO ps_staff USING (is_active);
CREATE POLICY lots_owner_all ON parking_lots FOR ALL TO ps_lot_owner
  USING (owner_id = app_user_id()) WITH CHECK (owner_id = app_user_id());
CREATE POLICY lots_admin_all ON parking_lots FOR ALL TO ps_admin USING (true) WITH CHECK (true);

-- LOT_STAFF
GRANT SELECT, INSERT, DELETE ON lot_staff TO ps_lot_owner;
GRANT SELECT ON lot_staff TO ps_staff;
GRANT SELECT, INSERT, DELETE ON lot_staff TO ps_admin;

CREATE POLICY staff_owner_all ON lot_staff FOR ALL TO ps_lot_owner
  USING (fn_owns_lot(lot_id)) WITH CHECK (fn_owns_lot(lot_id));
CREATE POLICY staff_self_sel ON lot_staff FOR SELECT TO ps_staff USING (user_id = app_user_id());
CREATE POLICY staff_admin_all ON lot_staff FOR ALL TO ps_admin USING (true) WITH CHECK (true);

-- SLOTS
GRANT SELECT ON slots TO ps_customer, ps_staff;
GRANT SELECT, INSERT, UPDATE, DELETE ON slots TO ps_lot_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON slots TO ps_admin;

CREATE POLICY slots_customer_sel ON slots FOR SELECT TO ps_customer
  USING (EXISTS (SELECT 1 FROM parking_lots l WHERE l.lot_id = slots.lot_id AND l.is_active));
CREATE POLICY slots_staff_sel ON slots FOR SELECT TO ps_staff USING (true);
CREATE POLICY slots_owner_all ON slots FOR ALL TO ps_lot_owner
  USING (fn_owns_lot(lot_id)) WITH CHECK (fn_owns_lot(lot_id));
CREATE POLICY slots_admin_all ON slots FOR ALL TO ps_admin USING (true) WITH CHECK (true);

-- BOOKINGS
-- No role has direct INSERT, UPDATE, DELETE; writes occur exclusively via SECURITY DEFINER functions.
GRANT SELECT ON bookings TO ps_customer, ps_lot_owner, ps_staff, ps_admin;

CREATE POLICY bookings_customer_sel ON bookings FOR SELECT TO ps_customer USING (user_id = app_user_id());
CREATE POLICY bookings_owner_sel    ON bookings FOR SELECT TO ps_lot_owner USING (fn_owns_lot(fn_slot_lot(slot_id)));
CREATE POLICY bookings_staff_sel    ON bookings FOR SELECT TO ps_staff USING (fn_staff_at_lot(fn_slot_lot(slot_id)));
CREATE POLICY bookings_admin_sel    ON bookings FOR SELECT TO ps_admin USING (true);

-- PAYMENTS
GRANT SELECT ON payments TO ps_customer, ps_lot_owner, ps_admin;

CREATE POLICY payments_customer_sel ON payments FOR SELECT TO ps_customer
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.booking_id = payments.booking_id AND b.user_id = app_user_id()));
CREATE POLICY payments_owner_sel ON payments FOR SELECT TO ps_lot_owner
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.booking_id = payments.booking_id AND fn_owns_lot(fn_slot_lot(b.slot_id))));
CREATE POLICY payments_admin_sel ON payments FOR SELECT TO ps_admin USING (true);

-- REVIEWS
GRANT SELECT ON reviews TO ps_customer, ps_lot_owner, ps_staff, ps_admin;
GRANT INSERT, UPDATE, DELETE ON reviews TO ps_customer;
GRANT DELETE ON reviews TO ps_admin;

CREATE POLICY reviews_sel_all ON reviews FOR SELECT TO ps_customer, ps_lot_owner, ps_staff, ps_admin USING (true);
CREATE POLICY reviews_customer_mod ON reviews FOR ALL TO ps_customer
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
CREATE POLICY reviews_admin_mod ON reviews FOR ALL TO ps_admin USING (true) WITH CHECK (true);

-- BOOKING_AUDIT_LOG
-- Read-only for owner and admin; writes are trigger-driven only.
GRANT SELECT ON booking_audit_log TO ps_lot_owner, ps_admin;

CREATE POLICY audit_owner_sel ON booking_audit_log FOR SELECT TO ps_lot_owner
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.booking_id = booking_audit_log.booking_id AND fn_owns_lot(fn_slot_lot(b.slot_id))));
CREATE POLICY audit_admin_sel ON booking_audit_log FOR SELECT TO ps_admin USING (true);

-- 6. Views Grants
GRANT SELECT ON v_lot_occupancy TO ps_lot_owner, ps_staff, ps_admin;
GRANT SELECT ON v_owner_revenue TO ps_lot_owner, ps_admin;
GRANT SELECT ON v_peak_hours TO ps_lot_owner, ps_staff, ps_admin;
GRANT SELECT ON v_my_bookings TO ps_customer, ps_lot_owner, ps_staff, ps_admin;

-- 7. Function and Procedure EXECUTE Rights
-- Context helpers needed by policy evaluations:
GRANT EXECUTE ON FUNCTION app_user_id, app_role, fn_owns_lot, fn_staff_at_lot, fn_slot_lot, fn_is_my_staff
  TO ps_customer, ps_lot_owner, ps_staff, ps_admin;

-- Availability & Pricing:
GRANT EXECUTE ON FUNCTION is_slot_available, calc_booking_amount, fn_lots_availability, fn_slot_grid
  TO ps_customer, ps_lot_owner, ps_admin;

-- Customer Booking Workflow:
GRANT EXECUTE ON FUNCTION sp_create_booking, sp_pay_booking, sp_cancel_booking
  TO ps_customer;

-- Staff & Owner Operations:
GRANT EXECUTE ON FUNCTION sp_check_in, sp_check_out
  TO ps_staff, ps_lot_owner;
GRANT EXECUTE ON FUNCTION sp_create_staff
  TO ps_lot_owner;

-- Procedures:
GRANT EXECUTE ON PROCEDURE sp_close_lot
  TO ps_lot_owner, ps_admin;

-- Daemon & Internal App Helpers:
GRANT EXECUTE ON FUNCTION expire_stale_holds
  TO ps_app, ps_admin;
GRANT EXECUTE ON FUNCTION fn_auth_lookup, fn_register_user
  TO ps_app;

