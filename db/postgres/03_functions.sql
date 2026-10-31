-- 03_functions.sql
-- Stored functions and procedures for ParkSmart

-- 1. Session Context Helpers
CREATE OR REPLACE FUNCTION app_user_id() RETURNS INT
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::INT;
$$;

CREATE OR REPLACE FUNCTION app_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.role', true), '');
$$;

-- 2. Ownership and Relationship Helpers (SECURITY DEFINER to avoid policy recursion)
CREATE OR REPLACE FUNCTION fn_slot_lot(p_slot_id INT) RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lot_id FROM slots WHERE slot_id = p_slot_id;
$$;

CREATE OR REPLACE FUNCTION fn_owns_lot(p_lot_id INT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM parking_lots
    WHERE lot_id = p_lot_id AND owner_id = app_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION fn_staff_at_lot(p_lot_id INT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM lot_staff
    WHERE lot_id = p_lot_id AND user_id = app_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION fn_is_my_staff(p_user_id INT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM lot_staff ls
    JOIN parking_lots l ON l.lot_id = ls.lot_id
    WHERE ls.user_id = p_user_id AND l.owner_id = app_user_id()
  );
$$;

-- 3. Availability and Pricing Calculation
CREATE OR REPLACE FUNCTION is_slot_available(p_slot_id INT, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM slots s
    JOIN parking_lots l ON l.lot_id = s.lot_id
    WHERE s.slot_id = p_slot_id AND s.status = 'active' AND l.is_active
  )
  AND NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.slot_id = p_slot_id
      AND b.status IN ('held','confirmed')
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_start, p_end, '[)')
  );
$$;

CREATE OR REPLACE FUNCTION calc_booking_amount(p_slot_id INT, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ROUND(
    CEIL(EXTRACT(EPOCH FROM (p_end - p_start)) / 3600.0) * l.base_rate_per_hr
    * CASE WHEN s.slot_type = 'ev' THEN 1.20 ELSE 1.00 END,
    2
  )
  FROM slots s
  JOIN parking_lots l ON l.lot_id = s.lot_id
  WHERE s.slot_id = p_slot_id;
$$;

-- Batch Lot Availability for search results
CREATE OR REPLACE FUNCTION fn_lots_availability(p_lot_ids INT[], p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE (
  o_lot_id INT,
  o_total_slots BIGINT,
  o_free_slots BIGINT,
  o_est_price NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH slot_status AS (
    SELECT
      s.lot_id,
      s.slot_id,
      EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.slot_id = s.slot_id
          AND b.status IN ('held','confirmed')
          AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_start, p_end, '[)')
      ) AS is_busy
    FROM slots s
    WHERE s.lot_id = ANY(p_lot_ids) AND s.status = 'active'
  )
  SELECT
    l.lot_id AS o_lot_id,
    COUNT(ss.slot_id) AS o_total_slots,
    COUNT(ss.slot_id) FILTER (WHERE NOT ss.is_busy) AS o_free_slots,
    ROUND(CEIL(EXTRACT(EPOCH FROM (p_end - p_start)) / 3600.0) * l.base_rate_per_hr, 2) AS o_est_price
  FROM parking_lots l
  LEFT JOIN slot_status ss ON ss.lot_id = l.lot_id
  WHERE l.lot_id = ANY(p_lot_ids) AND l.is_active
  GROUP BY l.lot_id, l.base_rate_per_hr;
$$;

-- Lot Slot-Grid view for booking page
CREATE OR REPLACE FUNCTION fn_slot_grid(p_lot_id INT, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE (
  o_slot_id INT,
  o_slot_label VARCHAR(10),
  o_slot_type VARCHAR(10),
  o_available BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.slot_id AS o_slot_id,
    s.slot_label AS o_slot_label,
    s.slot_type AS o_slot_type,
    (
      NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.slot_id = s.slot_id
          AND b.status IN ('held','confirmed')
          AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_start, p_end, '[)')
      )
    ) AS o_available
  FROM slots s
  JOIN parking_lots l ON l.lot_id = s.lot_id
  WHERE s.lot_id = p_lot_id AND s.status = 'active' AND l.is_active
  ORDER BY s.slot_label;
$$;

-- 4. Expire Stale Holds Function
CREATE OR REPLACE FUNCTION expire_stale_holds() RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n INT;
BEGIN
  UPDATE bookings
  SET status = 'expired'
  WHERE status = 'held' AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE payments p
  SET status = 'failed'
  FROM bookings b
  WHERE p.booking_id = b.booking_id
    AND b.status = 'expired'
    AND p.status = 'pending';

  RETURN n;
END $$;

-- 5. Booking Workflow: Create Booking (Hold)
CREATE OR REPLACE FUNCTION sp_create_booking(
  p_vehicle_id INT,
  p_slot_id INT,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE (
  o_booking_id INT,
  o_booking_code CHAR(8),
  o_amount NUMERIC,
  o_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user INT := app_user_id();
  v_vtype TEXT;
  v_stype TEXT;
  v_amount NUMERIC;
  v_id INT;
  v_code CHAR(8);
  v_exp TIMESTAMPTZ := now() + INTERVAL '10 minutes';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_start < now() - INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'START_IN_PAST';
  END IF;

  IF p_end - p_start < INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'TOO_SHORT';
  END IF;

  PERFORM expire_stale_holds();

  SELECT vehicle_type INTO v_vtype
  FROM vehicles
  WHERE vehicle_id = p_vehicle_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_OWNED';
  END IF;

  SELECT s.slot_type INTO v_stype
  FROM slots s
  JOIN parking_lots l ON l.lot_id = s.lot_id
  WHERE s.slot_id = p_slot_id AND s.status = 'active' AND l.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_NOT_BOOKABLE';
  END IF;

  IF v_stype = 'ev' AND v_vtype <> 'ev' THEN
    RAISE EXCEPTION 'SLOT_TYPE_MISMATCH';
  END IF;

  v_amount := calc_booking_amount(p_slot_id, p_start, p_end);

  -- Insert booking (exclusion constraint catches any race conditions)
  INSERT INTO bookings (user_id, vehicle_id, slot_id, start_time, end_time, status, amount, expires_at)
  VALUES (v_user, p_vehicle_id, p_slot_id, p_start, p_end, 'held', v_amount, v_exp)
  RETURNING bookings.booking_id, bookings.booking_code INTO v_id, v_code;

  INSERT INTO payments (booking_id, amount, status)
  VALUES (v_id, v_amount, 'pending');

  RETURN QUERY SELECT v_id, v_code, v_amount, v_exp;
END $$;

-- 6. Booking Workflow: Payment Simulation
CREATE OR REPLACE FUNCTION sp_pay_booking(
  p_booking_id INT,
  p_method TEXT,
  p_simulate_fail BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user INT := app_user_id();
  v_status VARCHAR(10);
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT status, expires_at INTO v_status, v_expires_at
  FROM bookings
  WHERE booking_id = p_booking_id AND user_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'BOOKING_NOT_FOUND';
  END IF;

  IF v_status <> 'held' THEN
    RETURN 'BOOKING_NOT_PAYABLE';
  END IF;

  IF v_expires_at < now() THEN
    PERFORM expire_stale_holds();
    RETURN 'HOLD_EXPIRED';
  END IF;

  IF p_simulate_fail THEN
    UPDATE payments
    SET status = 'failed', method = p_method
    WHERE booking_id = p_booking_id;
    RETURN 'PAYMENT_FAILED';
  ELSE
    -- Trigger payment_confirms_booking will set booking status = 'confirmed'
    UPDATE payments
    SET status = 'success', method = p_method, paid_at = now()
    WHERE booking_id = p_booking_id AND status IN ('pending', 'failed');
    RETURN 'CONFIRMED';
  END IF;
END $$;

-- 7. Booking Workflow: Cancellation
CREATE OR REPLACE FUNCTION sp_cancel_booking(p_booking_id INT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user INT := app_user_id();
  v_status VARCHAR(10);
  v_start TIMESTAMPTZ;
BEGIN
  SELECT status, start_time INTO v_status, v_start
  FROM bookings
  WHERE booking_id = p_booking_id AND user_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'BOOKING_NOT_FOUND';
  END IF;

  IF v_status = 'held' THEN
    UPDATE bookings SET status = 'cancelled' WHERE booking_id = p_booking_id;
    UPDATE payments SET status = 'failed' WHERE booking_id = p_booking_id;
    RETURN 'CANCELLED';
  ELSIF v_status = 'confirmed' THEN
    IF v_start > now() + INTERVAL '60 minutes' THEN
      UPDATE bookings SET status = 'cancelled' WHERE booking_id = p_booking_id;
      UPDATE payments SET status = 'refunded' WHERE booking_id = p_booking_id;
      RETURN 'CANCELLED_REFUNDED';
    ELSIF v_start > now() THEN
      UPDATE bookings SET status = 'cancelled' WHERE booking_id = p_booking_id;
      RETURN 'CANCELLED_NO_REFUND';
    ELSE
      RETURN 'NOT_CANCELLABLE';
    END IF;
  ELSE
    RETURN 'NOT_CANCELLABLE';
  END IF;
END $$;

-- 8. Staff Gate Operations: Check-In & Check-Out
CREATE OR REPLACE FUNCTION sp_check_in(p_booking_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bid INT;
  v_lot_id INT;
  v_status VARCHAR(10);
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_checked_in TIMESTAMPTZ;
BEGIN
  SELECT b.booking_id, s.lot_id, b.status, b.start_time, b.end_time, b.checked_in_at
  INTO v_bid, v_lot_id, v_status, v_start, v_end, v_checked_in
  FROM bookings b
  JOIN slots s ON s.slot_id = b.slot_id
  WHERE b.booking_code = upper(trim(p_booking_code));

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF NOT (fn_staff_at_lot(v_lot_id) OR fn_owns_lot(v_lot_id) OR app_role() = 'admin') THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_checked_in IS NOT NULL THEN
    RETURN 'ALREADY_CHECKED_IN';
  END IF;

  IF v_status <> 'confirmed' THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF now() < v_start - INTERVAL '15 minutes' THEN
    RETURN 'TOO_EARLY';
  END IF;

  IF now() > v_end THEN
    RETURN 'EXPIRED_WINDOW';
  END IF;

  UPDATE bookings SET checked_in_at = now() WHERE booking_id = v_bid;
  RETURN 'CHECKED_IN';
END $$;

CREATE OR REPLACE FUNCTION sp_check_out(p_booking_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bid INT;
  v_lot_id INT;
  v_checked_in TIMESTAMPTZ;
  v_checked_out TIMESTAMPTZ;
BEGIN
  SELECT b.booking_id, s.lot_id, b.checked_in_at, b.checked_out_at
  INTO v_bid, v_lot_id, v_checked_in, v_checked_out
  FROM bookings b
  JOIN slots s ON s.slot_id = b.slot_id
  WHERE b.booking_code = upper(trim(p_booking_code));

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF NOT (fn_staff_at_lot(v_lot_id) OR fn_owns_lot(v_lot_id) OR app_role() = 'admin') THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_checked_in IS NULL THEN
    RETURN 'NOT_CHECKED_IN';
  END IF;

  IF v_checked_out IS NOT NULL THEN
    RETURN 'ALREADY_CHECKED_OUT';
  END IF;

  UPDATE bookings
  SET checked_out_at = now(), status = 'completed'
  WHERE booking_id = v_bid;

  RETURN 'CHECKED_OUT';
END $$;

-- 9. Stored Procedure: Close Lot (Emergency closure by Owner or Admin)
CREATE OR REPLACE PROCEDURE sp_close_lot(p_lot_id INT, INOUT p_cancelled INT DEFAULT 0)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (fn_owns_lot(p_lot_id) OR app_role() = 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- 1. Refund/fail active payments first while booking statuses are still held/confirmed
  UPDATE payments p
  SET status = CASE WHEN b.status = 'confirmed' THEN 'refunded' ELSE 'failed' END
  FROM bookings b
  JOIN slots s ON s.slot_id = b.slot_id
  WHERE p.booking_id = b.booking_id
    AND s.lot_id = p_lot_id
    AND b.status IN ('held','confirmed')
    AND b.end_time > now()
    AND p.status IN ('pending','success');

  -- 2. Cancel all active future bookings
  UPDATE bookings b
  SET status = 'cancelled'
  FROM slots s
  WHERE s.slot_id = b.slot_id
    AND s.lot_id = p_lot_id
    AND b.status IN ('held','confirmed')
    AND b.end_time > now();

  GET DIAGNOSTICS p_cancelled = ROW_COUNT;

  -- 3. Deactivate parking lot
  UPDATE parking_lots SET is_active = FALSE WHERE lot_id = p_lot_id;
END $$;

-- 10. Auth and Staff Management Helpers
CREATE OR REPLACE FUNCTION fn_auth_lookup(p_email TEXT)
RETURNS TABLE (o_user_id INT, o_name TEXT, o_role TEXT, o_password_hash TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, name::TEXT, role::TEXT, password_hash::TEXT
  FROM users
  WHERE email = lower(trim(p_email));
$$;

CREATE OR REPLACE FUNCTION fn_register_user(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_password_hash TEXT,
  p_role TEXT
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id INT;
BEGIN
  IF p_role NOT IN ('customer','owner') THEN
    RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
  END IF;

  INSERT INTO users (name, email, phone, password_hash, role)
  VALUES (trim(p_name), lower(trim(p_email)), p_phone, p_password_hash, p_role)
  RETURNING user_id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION sp_create_staff(
  p_lot_id INT,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_password_hash TEXT
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id INT;
BEGIN
  IF NOT (fn_owns_lot(p_lot_id) OR app_role() = 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO users (name, email, phone, password_hash, role)
  VALUES (trim(p_name), lower(trim(p_email)), p_phone, p_password_hash, 'staff')
  RETURNING user_id INTO v_id;

  INSERT INTO lot_staff (lot_id, user_id)
  VALUES (p_lot_id, v_id);

  RETURN v_id;
END $$;

