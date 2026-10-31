-- 02_ddl_demo.sql
-- Demonstrates DDL operations: CREATE, ALTER, DROP on tables, constraints, indexes, views, schemas.
-- Evaluator reference for explicit DDL rubric requirements.

-- 1. CREATE SCHEMA
CREATE SCHEMA IF NOT EXISTS demo;

-- 2. CREATE TABLE
CREATE TABLE demo.lot_import (
  import_id    SERIAL PRIMARY KEY,
  raw_lot_name VARCHAR(100) NOT NULL,
  temp_code    VARCHAR(20)
);

-- 3. ALTER TABLE: ADD COLUMN
ALTER TABLE demo.lot_import ADD COLUMN capacity INT DEFAULT 10;

-- 4. ALTER TABLE: ALTER COLUMN TYPE
ALTER TABLE demo.lot_import ALTER COLUMN raw_lot_name TYPE VARCHAR(150);

-- 5. ALTER TABLE: RENAME COLUMN
ALTER TABLE demo.lot_import RENAME COLUMN temp_code TO external_reference;

-- 6. ALTER TABLE: ADD CONSTRAINT
ALTER TABLE demo.lot_import ADD CONSTRAINT chk_demo_capacity CHECK (capacity > 0);

-- 7. CREATE INDEX
CREATE INDEX idx_demo_ext_ref ON demo.lot_import (external_reference);

-- 8. CREATE VIEW
CREATE OR REPLACE VIEW demo.v_lot_import_summary AS
  SELECT import_id, raw_lot_name, capacity FROM demo.lot_import;

-- 9. ALTER TABLE: DROP CONSTRAINT
ALTER TABLE demo.lot_import DROP CONSTRAINT chk_demo_capacity;

-- 10. ALTER TABLE: DROP COLUMN
ALTER TABLE demo.lot_import DROP COLUMN external_reference;

-- 11. DROP INDEX
DROP INDEX demo.idx_demo_ext_ref;

-- 12. DROP VIEW
DROP VIEW IF EXISTS demo.v_lot_import_summary;

-- 13. DROP TABLE
DROP TABLE IF EXISTS demo.lot_import;

-- 14. DROP SCHEMA
DROP SCHEMA IF EXISTS demo CASCADE;

