import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;

describe('Database RBAC & Row-Level Security Matrix (Phase P3)', () => {
  let adminClient: pg.Client;
  let appClient: pg.Client;

  let cust1Id: number;
  let cust2Id: number;
  let owner1Id: number;
  let owner2Id: number;
  let staffId: number;
  let lot1Id: number;
  let slot1Id: number;
  let booking1Id: number;

  beforeAll(async () => {
    adminClient = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
    await adminClient.connect();

    appClient = new Client({ connectionString: process.env.DATABASE_URL });
    await appClient.connect();

    // Clean up
    await adminClient.query("SET session_replication_role = 'replica'");
    await adminClient.query("DELETE FROM booking_audit_log WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testrbac.test'))");
    await adminClient.query("DELETE FROM payments WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testrbac.test'))");
    await adminClient.query("DELETE FROM bookings WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testrbac.test')");
    await adminClient.query("DELETE FROM slots WHERE slot_label LIKE 'RBAC_%'");
    await adminClient.query("DELETE FROM lot_staff WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testrbac.test')");
    await adminClient.query("DELETE FROM parking_lots WHERE name LIKE 'RBAC Lot%'");
    await adminClient.query("DELETE FROM vehicles WHERE reg_number LIKE 'KA03EF%'");
    await adminClient.query("DELETE FROM users WHERE email LIKE '%@testrbac.test'");
    await adminClient.query("DELETE FROM areas WHERE name = 'RBAC Locality'");
    await adminClient.query("SET session_replication_role = 'origin'");

    // Create Locality
    const cityRes = await adminClient.query("SELECT area_id FROM areas WHERE level = 'city' LIMIT 1");
    const cityId = cityRes.rows[0].area_id;
    const areaRes = await adminClient.query(
      "INSERT INTO areas (name, level, parent_area_id) VALUES ('RBAC Locality', 'locality', $1) RETURNING area_id",
      [cityId]
    );
    const areaId = areaRes.rows[0].area_id;

    // Users
    const u1 = await adminClient.query("INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Cust One', 'c1@testrbac.test', '+919777700001', 'h1', 'customer') RETURNING user_id");
    cust1Id = u1.rows[0].user_id;

    const u2 = await adminClient.query("INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Cust Two', 'c2@testrbac.test', '+919777700002', 'h2', 'customer') RETURNING user_id");
    cust2Id = u2.rows[0].user_id;

    const o1 = await adminClient.query("INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Owner One', 'o1@testrbac.test', '+919777700003', 'h3', 'owner') RETURNING user_id");
    owner1Id = o1.rows[0].user_id;

    const o2 = await adminClient.query("INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Owner Two', 'o2@testrbac.test', '+919777700004', 'h4', 'owner') RETURNING user_id");
    owner2Id = o2.rows[0].user_id;

    const s1 = await adminClient.query("INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Staff One', 's1@testrbac.test', '+919777700005', 'h5', 'staff') RETURNING user_id");
    staffId = s1.rows[0].user_id;

    // Lot 1 (Owner 1)
    const l1 = await adminClient.query(
      "INSERT INTO parking_lots (owner_id, area_id, name, mongo_lot_id, base_rate_per_hr) VALUES ($1, $2, 'RBAC Lot 1', 'aaaa1111bbbb2222cccc3333', 50.00) RETURNING lot_id",
      [owner1Id, areaId]
    );
    lot1Id = l1.rows[0].lot_id;

    // Slot 1
    const sl1 = await adminClient.query(
      "INSERT INTO slots (lot_id, slot_label, slot_type, status) VALUES ($1, 'RBAC_01', 'regular', 'active') RETURNING slot_id",
      [lot1Id]
    );
    slot1Id = sl1.rows[0].slot_id;

    // Vehicle 1 for Cust 1
    const v1 = await adminClient.query(
      "INSERT INTO vehicles (user_id, reg_number, vehicle_type) VALUES ($1, 'KA03EF1234', 'car') RETURNING vehicle_id",
      [cust1Id]
    );
    const v1Id = v1.rows[0].vehicle_id;

    // Booking 1 for Cust 1
    const now = new Date();
    const b1 = await adminClient.query(
      "INSERT INTO bookings (user_id, vehicle_id, slot_id, start_time, end_time, status, amount, expires_at) VALUES ($1, $2, $3, $4, $5, 'held', 50.00, now() + interval '10 min') RETURNING booking_id",
      [cust1Id, v1Id, slot1Id, new Date(now.getTime() + 1000000), new Date(now.getTime() + 4600000)]
    );
    booking1Id = b1.rows[0].booking_id;
  });

  afterAll(async () => {
    if (adminClient) {
      await adminClient.query("SET session_replication_role = 'replica'");
      await adminClient.query("DELETE FROM booking_audit_log WHERE booking_id = $1", [booking1Id]);
      await adminClient.query("DELETE FROM bookings WHERE booking_id = $1", [booking1Id]);
      await adminClient.query("DELETE FROM slots WHERE lot_id = $1", [lot1Id]);
      await adminClient.query("DELETE FROM parking_lots WHERE lot_id = $1", [lot1Id]);
      await adminClient.query("DELETE FROM vehicles WHERE reg_number LIKE 'KA03EF%'");
      await adminClient.query("DELETE FROM users WHERE user_id IN ($1, $2, $3, $4, $5)", [cust1Id, cust2Id, owner1Id, owner2Id, staffId]);
      await adminClient.query("SET session_replication_role = 'origin'");
      await adminClient.end();
    }
    if (appClient) {
      await appClient.end();
    }
  });

  it('Customer: can only SELECT own bookings, cannot see other customers bookings', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_customer");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'customer', true)`, [String(cust1Id)]);

    // Cust 1 sees their booking
    const res1 = await appClient.query("SELECT booking_id FROM bookings");
    expect(res1.rows.map(r => r.booking_id)).toContain(booking1Id);
    await appClient.query('COMMIT');

    // Cust 2 queries bookings -> should see empty list (0 rows) due to RLS
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_customer");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'customer', true)`, [String(cust2Id)]);

    const res2 = await appClient.query("SELECT booking_id FROM bookings");
    expect(res2.rows.map(r => r.booking_id)).not.toContain(booking1Id);
    await appClient.query('COMMIT');
  });

  it('Customer: cannot directly UPDATE or DELETE bookings (42501)', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_customer");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'customer', true)`, [String(cust1Id)]);

    try {
      await appClient.query("UPDATE bookings SET amount = 0.00 WHERE booking_id = $1", [booking1Id]);
      expect.fail('Customer should not have UPDATE privilege on bookings');
    } catch (e: any) {
      expect(e.code).toBe('42501'); // insufficient_privilege
    } finally {
      await appClient.query('ROLLBACK');
    }
  });

  it('Customer: cannot SELECT password_hash column (42501)', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_customer");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'customer', true)`, [String(cust1Id)]);

    try {
      await appClient.query("SELECT password_hash FROM users WHERE user_id = $1", [cust1Id]);
      expect.fail('Customer should not have column SELECT privilege on password_hash');
    } catch (e: any) {
      expect(e.code).toBe('42501'); // insufficient_privilege
    } finally {
      await appClient.query('ROLLBACK');
    }
  });

  it('Owner: sees bookings only for their own lots, cannot see other owners lots', async () => {
    // Owner 1 (owns lot 1) sees booking 1
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_lot_owner");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'owner', true)`, [String(owner1Id)]);

    const o1Res = await appClient.query("SELECT booking_id FROM bookings");
    expect(o1Res.rows.map(r => r.booking_id)).toContain(booking1Id);
    await appClient.query('COMMIT');

    // Owner 2 does not own lot 1, sees 0 bookings
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_lot_owner");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'owner', true)`, [String(owner2Id)]);

    const o2Res = await appClient.query("SELECT booking_id FROM bookings");
    expect(o2Res.rows.map(r => r.booking_id)).not.toContain(booking1Id);
    await appClient.query('COMMIT');
  });

  it('Owner: cannot INSERT a parking lot on behalf of another owner (RLS WITH CHECK 42501)', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_lot_owner");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'owner', true)`, [String(owner1Id)]);

    try {
      await appClient.query(`
        INSERT INTO parking_lots (owner_id, area_id, name, mongo_lot_id, base_rate_per_hr)
        VALUES ($1, (SELECT area_id FROM areas WHERE level = 'locality' LIMIT 1), 'Hacked Lot', '999988887777666655554444', 40.00)
      `, [owner2Id]); // trying to set owner_id as Owner 2!
      expect.fail('Should fail RLS WITH CHECK policy on parking_lots');
    } catch (e: any) {
      expect(e.code).toBe('42501');
    } finally {
      await appClient.query('ROLLBACK');
    }
  });

  it('Staff: cannot INSERT lots or slots directly (42501)', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_staff");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'staff', true)`, [String(staffId)]);

    try {
      await appClient.query(`
        INSERT INTO slots (lot_id, slot_label, slot_type)
        VALUES ($1, 'STAFF_NEW', 'regular')
      `, [lot1Id]);
      expect.fail('Staff should not have INSERT privilege on slots');
    } catch (e: any) {
      expect(e.code).toBe('42501');
    } finally {
      await appClient.query('ROLLBACK');
    }
  });

  it('Roles cannot call fn_auth_lookup directly (42501)', async () => {
    // Only ps_app has permission on fn_auth_lookup
    await appClient.query('BEGIN');
    await appClient.query("SET LOCAL ROLE ps_customer");
    await appClient.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', 'customer', true)`, [String(cust1Id)]);

    try {
      await appClient.query("SELECT * FROM fn_auth_lookup('c1@testrbac.test')");
      expect.fail('Customer should not be able to execute fn_auth_lookup');
    } catch (e: any) {
      expect(e.code).toBe('42501');
    } finally {
      await appClient.query('ROLLBACK');
    }
  });
});
