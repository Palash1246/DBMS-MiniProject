-- 04_triggers.sql
-- Database triggers for audit logging, lifecycle events, and integrity validation.
-- All functions are SECURITY DEFINER with search_path = public.

-- 1. Booking Audit Log Trigger
CREATE OR REPLACE FUNCTION trg_bookings_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO booking_audit_log (booking_id, old_status, new_status, changed_by)
    VALUES (NEW.booking_id, NULL, NEW.status, app_user_id());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO booking_audit_log (booking_id, old_status, new_status, changed_by)
    VALUES (NEW.booking_id, OLD.status, NEW.status, app_user_id());
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS bookings_audit ON bookings;
CREATE TRIGGER bookings_audit
AFTER INSERT OR UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION trg_bookings_audit();


-- 2. Payment Success Confirms Booking Trigger
CREATE OR REPLACE FUNCTION trg_payment_confirms_booking() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE bookings
  SET status = 'confirmed', expires_at = NULL
  WHERE booking_id = NEW.booking_id AND status = 'held';
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS payment_confirms_booking ON payments;
CREATE TRIGGER payment_confirms_booking
AFTER UPDATE OF status ON payments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'success')
EXECUTE FUNCTION trg_payment_confirms_booking();


-- 3. Audit Log Immutability Trigger
CREATE OR REPLACE FUNCTION trg_audit_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_IMMUTABLE';
END $$;

DROP TRIGGER IF EXISTS audit_immutable ON booking_audit_log;
CREATE TRIGGER audit_immutable
BEFORE UPDATE OR DELETE ON booking_audit_log
FOR EACH ROW EXECUTE FUNCTION trg_audit_immutable();


-- 4. Review Requires Completed Visit Trigger
CREATE OR REPLACE FUNCTION trg_review_requires_visit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bookings b
    JOIN slots s ON s.slot_id = b.slot_id
    WHERE b.user_id = NEW.user_id
      AND s.lot_id = NEW.lot_id
      AND b.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'NO_COMPLETED_BOOKING';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS review_requires_visit ON reviews;
CREATE TRIGGER review_requires_visit
BEFORE INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION trg_review_requires_visit();


-- 5. Parking Lot Referential Integrity Trigger
CREATE OR REPLACE FUNCTION trg_lot_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE user_id = NEW.owner_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'INVALID_LOT_OWNER: User must have role owner or admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM areas WHERE area_id = NEW.area_id AND level = 'locality'
  ) THEN
    RAISE EXCEPTION 'AREA_MUST_BE_LOCALITY: Parking lots can only be assigned to a locality';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lot_integrity ON parking_lots;
CREATE TRIGGER lot_integrity
BEFORE INSERT OR UPDATE ON parking_lots
FOR EACH ROW EXECUTE FUNCTION trg_lot_integrity();


-- 6. Lot Staff Role Integrity Trigger
CREATE OR REPLACE FUNCTION trg_staff_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE user_id = NEW.user_id AND role = 'staff'
  ) THEN
    RAISE EXCEPTION 'USER_MUST_BE_STAFF: Only users with role staff can be assigned to a lot';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS staff_integrity ON lot_staff;
CREATE TRIGGER staff_integrity
BEFORE INSERT OR UPDATE ON lot_staff
FOR EACH ROW EXECUTE FUNCTION trg_staff_integrity();

