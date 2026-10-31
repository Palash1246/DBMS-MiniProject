-- 01_schema.sql
-- ParkSmart Core Relational Schema

CREATE TABLE areas (
  area_id        SERIAL PRIMARY KEY,
  name           VARCHAR(80) NOT NULL,
  level          VARCHAR(10) NOT NULL CHECK (level IN ('city','zone','locality')),
  parent_area_id INT REFERENCES areas(area_id) ON DELETE RESTRICT,
  CONSTRAINT uq_area_name_parent UNIQUE (name, parent_area_id),
  CONSTRAINT chk_area_root CHECK ((level = 'city') = (parent_area_id IS NULL))
);

CREATE TABLE users (
  user_id       SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL CHECK (length(trim(name)) >= 2),
  email         VARCHAR(150) NOT NULL UNIQUE
                CHECK (email = lower(email) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone         VARCHAR(15)  NOT NULL UNIQUE CHECK (phone ~ '^\+?[0-9]{10,13}$'),
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(10)  NOT NULL CHECK (role IN ('customer','owner','staff','admin')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  vehicle_id   SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reg_number   VARCHAR(15) NOT NULL UNIQUE CHECK (reg_number ~ '^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$'),
  vehicle_type VARCHAR(10) NOT NULL CHECK (vehicle_type IN ('car','bike','ev')),
  CONSTRAINT uq_vehicle_owner UNIQUE (vehicle_id, user_id)
);

CREATE TABLE parking_lots (
  lot_id           SERIAL PRIMARY KEY,
  owner_id         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  area_id          INT NOT NULL REFERENCES areas(area_id),
  name             VARCHAR(120) NOT NULL,
  mongo_lot_id     CHAR(24) NOT NULL UNIQUE CHECK (mongo_lot_id ~ '^[0-9a-f]{24}$'),
  base_rate_per_hr NUMERIC(8,2) NOT NULL CHECK (base_rate_per_hr > 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lot_owner_name UNIQUE (owner_id, name)
);

CREATE TABLE lot_staff (
  lot_id      INT NOT NULL REFERENCES parking_lots(lot_id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lot_id, user_id)
);

CREATE TABLE slots (
  slot_id    SERIAL PRIMARY KEY,
  lot_id     INT NOT NULL REFERENCES parking_lots(lot_id) ON DELETE CASCADE,
  slot_label VARCHAR(10) NOT NULL,
  slot_type  VARCHAR(10) NOT NULL DEFAULT 'regular' CHECK (slot_type IN ('regular','ev','disabled')),
  status     VARCHAR(12) NOT NULL DEFAULT 'active'  CHECK (status IN ('active','maintenance')),
  CONSTRAINT uq_slot_label UNIQUE (lot_id, slot_label)
);

CREATE TABLE bookings (
  booking_id   SERIAL PRIMARY KEY,
  booking_code CHAR(8) NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  user_id      INT NOT NULL REFERENCES users(user_id),
  vehicle_id   INT NOT NULL,
  slot_id      INT NOT NULL REFERENCES slots(slot_id),
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  status       VARCHAR(10) NOT NULL DEFAULT 'held'
               CHECK (status IN ('held','confirmed','cancelled','expired','completed')),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_time_order   CHECK (end_time > start_time),
  CONSTRAINT chk_max_duration CHECK (end_time - start_time <= INTERVAL '24 hours'),
  CONSTRAINT chk_hold_expiry  CHECK (status <> 'held' OR expires_at IS NOT NULL)
);

CREATE TABLE payments (
  payment_id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  amount     NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  method     VARCHAR(10) CHECK (method IN ('upi','card','wallet')),
  status     VARCHAR(10) NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','success','failed','refunded')),
  paid_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_paid_at CHECK ((status IN ('success','refunded')) = (paid_at IS NOT NULL))
);

CREATE TABLE reviews (
  review_id  SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  lot_id     INT NOT NULL REFERENCES parking_lots(lot_id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT CHECK (comment IS NULL OR length(comment) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_review_user_lot UNIQUE (user_id, lot_id)
);

CREATE TABLE booking_audit_log (
  log_id     BIGSERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  old_status VARCHAR(10),
  new_status VARCHAR(10) NOT NULL,
  changed_by INT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints and columns added with ALTER TABLE to satisfy rubric DDL demonstration
ALTER TABLE bookings ADD COLUMN checked_in_at  TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN checked_out_at TIMESTAMPTZ;

ALTER TABLE bookings ADD CONSTRAINT chk_checkin_order
  CHECK (checked_out_at IS NULL OR (checked_in_at IS NOT NULL AND checked_out_at >= checked_in_at));

-- Ensure vehicle belongs to the same user making the booking
ALTER TABLE bookings ADD CONSTRAINT fk_booking_vehicle_owner
  FOREIGN KEY (vehicle_id, user_id) REFERENCES vehicles (vehicle_id, user_id);

-- Central Concurrency Invariant: No overlapping active bookings for the same slot
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (slot_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
  WHERE (status IN ('held','confirmed'));

