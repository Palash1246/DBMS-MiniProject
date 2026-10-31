-- 00_roles_extensions.sql
-- Enables btree_gist for temporal exclusion constraints and sets up database roles.
-- Run as superuser (postgres).

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ps_customer')  THEN CREATE ROLE ps_customer  NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ps_lot_owner') THEN CREATE ROLE ps_lot_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ps_staff')     THEN CREATE ROLE ps_staff     NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ps_admin')     THEN CREATE ROLE ps_admin     NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ps_app')       THEN CREATE ROLE ps_app LOGIN NOINHERIT; END IF;
END $$;

-- Allow application connection user (ps_app) to switch into role-specific sessions
GRANT ps_customer, ps_lot_owner, ps_staff, ps_admin TO ps_app;

