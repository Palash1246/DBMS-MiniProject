# Implementation Deviations & Refinements

This document records any adjustments made from the initial reference specification during implementation and live database verification against PostgreSQL 16 and MongoDB 7.

---

### DEV-01: `db/postgres/02_ddl_demo.sql` Drop Order
- **Observation:** In PostgreSQL, dropping a table column (`DROP COLUMN external_reference`) automatically drops any index dependent on that column. Running `DROP INDEX demo.idx_demo_ext_ref` after dropping the column produced error `42704: index "idx_demo_ext_ref" does not exist`.
- **Resolution:** Updated `02_ddl_demo.sql` to explicitly call `DROP INDEX IF EXISTS demo.idx_demo_ext_ref;` *before* issuing `ALTER TABLE demo.lot_import DROP COLUMN external_reference;`.
- **Status:** Verified and passes cleanly with `--with-demo`.

