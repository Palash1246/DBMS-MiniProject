import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;

describe('Stored Procedures, Triggers & Views Verification (Phase P2)', () => {
  let client: pg.Client;
  let customerId: number;
  let ownerId: number;
  let staffId: number;
  let lotId: number;
  let slotId: number;
  let vehicleId: number;

  beforeAll(async () => {
    const adminUrl = process.env.DATABASE_ADMIN_URL;
    expect(adminUrl).toBeDefined();
    client = new Client({ connectionString: adminUrl });
    await client.connect();

    // Clean up
    await client.query("SET session_replication_role = 'replica'");
    await client.query("DELETE FROM booking_audit_log WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testlogic.test'))");
    await client.query("DELETE FROM payments WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testlogic.test'))");
    await client.query("DELETE FROM bookings WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testlogic.test')");
    await client.query("DELETE FROM slots WHERE slot_label LIKE 'LOGIC_%'");
    await client.query("DELETE FROM lot_staff WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testlogic.test')");
    await client.query("DELETE FROM parking_lots WHERE name LIKE 'Logic Test Lot%'");
    await client.query("DELETE FROM vehicles WHERE reg_number LIKE 'KA02CD%'");
    await client.query("DELETE FROM users WHERE email LIKE '%@testlogic.test'");
    await client.query("DELETE FROM areas WHERE name = 'Logic Locality'");
    await client.query("SET session_replication_role = 'origin'");

    // Locality
    const cityRes = await client.query("SELECT area_id FROM areas WHERE level = 'city' LIMIT 1");
    const cityId = cityRes.rows[0].area_id;
    const areaRes = await client.query(
      "INSERT INTO areas (name, level, parent_area_id) VALUES ('Logic Locality', 'locality', $1) RETURNING area_id",
      [cityId]
    );
    const areaId = areaRes.rows[0].area_id;

    // Users
    const ownerRes = await client.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Logic Owner', 'owner@testlogic.test', '+919888800001', 'hash', 'owner') RETURNING user_id"
    );
    ownerId = ownerRes.rows[0].user_id;

    const custRes = await client.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Logic Cust', 'cust@testlogic.test', '+919888800002', 'hash', 'customer') RETURNING user_id"
    );
    customerId = custRes.rows[0].user_id;

    const staffRes = await client.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Logic Staff', 'staff@testlogic.test', '+919888800003', 'hash', 'staff') RETURNING user_id"
    );
    staffId = staffRes.rows[0].user_id;

    // Vehicle
    const vehRes = await client.query(
      "INSERT INTO vehicles (user_id, reg_number, vehicle_type) VALUES ($1, 'KA02CD1234', 'car') RETURNING vehicle_id",
      [customerId]
    );
    vehicleId = vehRes.rows[0].vehicle_id;

    // Lot
    const lotRes = await client.query(
      "INSERT INTO parking_lots (owner_id, area_id, name, mongo_lot_id, base_rate_per_hr) VALUES ($1, $2, 'Logic Test Lot', '111122223333444455556666', 60.00) RETURNING lot_id",
      [ownerId, areaId]
    );
    lotId = lotRes.rows[0].lot_id;

    // Staff assignment
    await client.query("INSERT INTO lot_staff (lot_id, user_id) VALUES ($1, $2)", [lotId, staffId]);

    // Slot
    const slotRes = await client.query(
      "INSERT INTO slots (lot_id, slot_label, slot_type, status) VALUES ($1, 'LOGIC_01', 'regular', 'active') RETURNING slot_id",
      [lotId]
    );
    slotId = slotRes.rows[0].slot_id;
  });

  afterAll(async () => {
    if (client) {
      await client.query("SET session_replication_role = 'replica'");
      await client.query("DELETE FROM booking_audit_log WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id = $1)", [customerId]);
      await client.query("DELETE FROM payments WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id = $1)", [customerId]);
      await client.query("DELETE FROM bookings WHERE user_id = $1", [customerId]);
      await client.query("DELETE FROM slots WHERE lot_id = $1", [lotId]);
      await client.query("DELETE FROM lot_staff WHERE lot_id = $1", [lotId]);
      await client.query("DELETE FROM parking_lots WHERE lot_id = $1", [lotId]);
      await client.query("DELETE FROM vehicles WHERE user_id = $1", [customerId]);
      await client.query("DELETE FROM users WHERE user_id IN ($1, $2, $3)", [customerId, ownerId, staffId]);
      await client.query("SET session_replication_role = 'origin'");
      await client.end();
    }
  });

  it('sp_create_booking holds slot and calculates amount correctly', async () => {
    // Set customer context
    await client.query(`SELECT set_config('app.user_id', $1, false), set_config('app.role', 'customer', false)`, [String(customerId)]);

    const now = new Date();
    const start = new Date(now.getTime() + 600000);  // +10 mins
    const end = new Date(now.getTime() + 8700000);   // +2 hours 25 mins (duration = 2h 15m -> ceil to 3h * 60 = 180)

    const res = await client.query(
      `SELECT * FROM sp_create_booking($1, $2, $3, $4)`,
      [vehicleId, slotId, start, end]
    );

    expect(res.rows.length).toBe(1);
    const booking = res.rows[0];
    expect(booking.o_booking_id).toBeDefined();
    expect(booking.o_booking_code).toHaveLength(8);
    expect(Number(booking.o_amount)).toBe(180.00);

    // Verify payments row was created
    const payRes = await client.query("SELECT * FROM payments WHERE booking_id = $1", [booking.o_booking_id]);
    expect(payRes.rows.length).toBe(1);
    expect(payRes.rows[0].status).toBe('pending');

    // Verify audit trigger fired
    const auditRes = await client.query("SELECT * FROM booking_audit_log WHERE booking_id = $1", [booking.o_booking_id]);
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].new_status).toBe('held');
  });

  it('sp_pay_booking confirms booking via payment trigger', async () => {
    // Customer session
    await client.query(`SELECT set_config('app.user_id', $1, false), set_config('app.role', 'customer', false)`, [String(customerId)]);

    const latestBooking = await client.query(
      "SELECT booking_id FROM bookings WHERE user_id = $1 ORDER BY booking_id DESC LIMIT 1",
      [customerId]
    );
    const bId = latestBooking.rows[0].booking_id;

    const payRes = await client.query("SELECT sp_pay_booking($1, 'upi', false) AS result", [bId]);
    expect(payRes.rows[0].result).toBe('CONFIRMED');

    // Verify booking status was flipped by trigger to 'confirmed'
    const bCheck = await client.query("SELECT status, expires_at FROM bookings WHERE booking_id = $1", [bId]);
    expect(bCheck.rows[0].status).toBe('confirmed');
    expect(bCheck.rows[0].expires_at).toBeNull();

    // Verify audit log has the new confirmed row
    const auditRes = await client.query(
      "SELECT * FROM booking_audit_log WHERE booking_id = $1 ORDER BY log_id DESC",
      [bId]
    );
    expect(auditRes.rows[0].old_status).toBe('held');
    expect(auditRes.rows[0].new_status).toBe('confirmed');
  });

  it('enforces audit log immutability against UPDATE or DELETE', async () => {
    const auditRow = await client.query("SELECT log_id FROM booking_audit_log LIMIT 1");
    const logId = auditRow.rows[0].log_id;

    try {
      await client.query("UPDATE booking_audit_log SET new_status = 'hacked' WHERE log_id = $1", [logId]);
      expect.fail('Should have failed immutability check');
    } catch (e: any) {
      expect(e.message).toContain('AUDIT_IMMUTABLE');
    }

    try {
      await client.query("DELETE FROM booking_audit_log WHERE log_id = $1", [logId]);
      expect.fail('Should have failed immutability check');
    } catch (e: any) {
      expect(e.message).toContain('AUDIT_IMMUTABLE');
    }
  });

  it('review trigger prevents review if customer has not completed a visit', async () => {
    try {
      await client.query(
        "INSERT INTO reviews (user_id, lot_id, rating, comment) VALUES ($1, $2, 5, 'Great parking!')",
        [customerId, lotId]
      );
      expect.fail('Review without completed booking should fail');
    } catch (e: any) {
      expect(e.message).toContain('NO_COMPLETED_BOOKING');
    }
  });

  it('staff check-in and check-out completes the visit', async () => {
    // Find confirmed booking code
    const bRow = await client.query(
      "SELECT booking_code FROM bookings WHERE user_id = $1 AND status = 'confirmed' LIMIT 1",
      [customerId]
    );
    const code = bRow.rows[0].booking_code;

    // Staff session
    await client.query(`SELECT set_config('app.user_id', $1, false), set_config('app.role', 'staff', false)`, [String(staffId)]);

    const checkInRes = await client.query("SELECT sp_check_in($1) AS result", [code]);
    expect(checkInRes.rows[0].result).toBe('CHECKED_IN');

    const checkOutRes = await client.query("SELECT sp_check_out($1) AS result", [code]);
    expect(checkOutRes.rows[0].result).toBe('CHECKED_OUT');

    const finalBooking = await client.query(
      "SELECT status, checked_in_at, checked_out_at FROM bookings WHERE booking_code = $1",
      [code]
    );
    expect(finalBooking.rows[0].status).toBe('completed');
    expect(finalBooking.rows[0].checked_in_at).toBeDefined();
    expect(finalBooking.rows[0].checked_out_at).toBeDefined();
  });

  it('now allows review submission after completing a visit', async () => {
    const revRes = await client.query(
      "INSERT INTO reviews (user_id, lot_id, rating, comment) VALUES ($1, $2, 5, 'Smooth parking experience!') RETURNING review_id",
      [customerId, lotId]
    );
    expect(revRes.rows[0].review_id).toBeDefined();
  });

  it('v_my_bookings view returns comprehensive booking details', async () => {
    const viewRes = await client.query(
      "SELECT * FROM v_my_bookings WHERE user_id = $1",
      [customerId]
    );
    expect(viewRes.rows.length).toBeGreaterThan(0);
    const row = viewRes.rows[0];
    expect(row.reg_number).toBe('KA02CD1234');
    expect(row.slot_label).toBe('LOGIC_01');
    expect(row.payment_status).toBe('success');
  });
});
