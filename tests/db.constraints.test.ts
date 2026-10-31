import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;

describe('Database Constraints & Exclusion Verification', () => {
  let client: pg.Client;
  let testUserId: number;
  let testVehicleId: number;
  let testOwnerId: number;
  let testAreaId: number;
  let testLotId: number;
  let testSlotId: number;

  beforeAll(async () => {
    const adminUrl = process.env.DATABASE_ADMIN_URL;
    expect(adminUrl).toBeDefined();
    client = new Client({ connectionString: adminUrl });
    await client.connect();

    // Clean up previous test entities
    await client.query("SET session_replication_role = 'replica'");
    await client.query("DELETE FROM booking_audit_log WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testconstraints.test'))");
    await client.query("DELETE FROM bookings WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@testconstraints.test')");
    await client.query("DELETE FROM slots WHERE slot_label LIKE 'TEST_%'");
    await client.query("DELETE FROM parking_lots WHERE name LIKE 'Test Lot Constraints%'");
    await client.query("DELETE FROM vehicles WHERE reg_number LIKE 'KA01AB%'");
    await client.query("DELETE FROM users WHERE email LIKE '%@testconstraints.test'");
    await client.query("DELETE FROM areas WHERE name = 'Test Locality Constraints'");
    await client.query("SET session_replication_role = 'origin'");

    // Create Root Area & Locality
    const cityRes = await client.query("SELECT area_id FROM areas WHERE level = 'city' LIMIT 1");
    let cityId: number;
    if (cityRes.rows.length === 0) {
      const c = await client.query("INSERT INTO areas (name, level) VALUES ('Bengaluru Test', 'city') RETURNING area_id");
      cityId = c.rows[0].area_id;
    } else {
      cityId = cityRes.rows[0].area_id;
    }

    const areaRes = await client.query(
      "INSERT INTO areas (name, level, parent_area_id) VALUES ('Test Locality Constraints', 'locality', $1) RETURNING area_id",
      [cityId]
    );
    testAreaId = areaRes.rows[0].area_id;

    // Create Owner & Customer users
    const ownerRes = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role)
      VALUES ('Test Owner', 'owner@testconstraints.test', '+919999900001', 'dummyhash', 'owner')
      RETURNING user_id
    `);
    testOwnerId = ownerRes.rows[0].user_id;

    const custRes = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role)
      VALUES ('Test Customer', 'cust@testconstraints.test', '+919999900002', 'dummyhash', 'customer')
      RETURNING user_id
    `);
    testUserId = custRes.rows[0].user_id;

    // Create Vehicle with valid Karnataka format (e.g. KA01AB1234)
    const vehRes = await client.query(`
      INSERT INTO vehicles (user_id, reg_number, vehicle_type)
      VALUES ($1, 'KA01AB1234', 'car')
      RETURNING vehicle_id
    `, [testUserId]);
    testVehicleId = vehRes.rows[0].vehicle_id;

    // Create Lot
    const lotRes = await client.query(`
      INSERT INTO parking_lots (owner_id, area_id, name, mongo_lot_id, base_rate_per_hr)
      VALUES ($1, $2, 'Test Lot Constraints', '0123456789abcdef01234567', 50.00)
      RETURNING lot_id
    `, [testOwnerId, testAreaId]);
    testLotId = lotRes.rows[0].lot_id;

    // Create Slot
    const slotRes = await client.query(`
      INSERT INTO slots (lot_id, slot_label, slot_type, status)
      VALUES ($1, 'TEST_S01', 'regular', 'active')
      RETURNING slot_id
    `, [testLotId]);
    testSlotId = slotRes.rows[0].slot_id;
  });

  afterAll(async () => {
    if (client) {
      await client.query("SET session_replication_role = 'replica'");
      await client.query("DELETE FROM booking_audit_log WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id = $1)", [testUserId]);
      await client.query("DELETE FROM bookings WHERE user_id = $1", [testUserId]);
      await client.query("DELETE FROM slots WHERE lot_id = $1", [testLotId]);
      await client.query("DELETE FROM parking_lots WHERE lot_id = $1", [testLotId]);
      await client.query("DELETE FROM vehicles WHERE user_id = $1", [testUserId]);
      await client.query("DELETE FROM users WHERE user_id IN ($1, $2)", [testUserId, testOwnerId]);
      await client.query("DELETE FROM areas WHERE area_id = $1", [testAreaId]);
      await client.query("SET session_replication_role = 'origin'");
      await client.end();
    }
  });

  it('rejects invalid email formats via CHECK constraint (23514)', async () => {
    try {
      await client.query(`
        INSERT INTO users (name, email, phone, password_hash, role)
        VALUES ('Bad Email', 'not-an-email', '+919999999999', 'hash', 'customer')
      `);
      expect.fail('Should have failed check constraint');
    } catch (e: any) {
      expect(e.code).toBe('23514'); // check_violation
    }
  });

  it('rejects duplicate vehicle registration numbers via UNIQUE constraint (23505)', async () => {
    try {
      await client.query(`
        INSERT INTO vehicles (user_id, reg_number, vehicle_type)
        VALUES ($1, 'KA01AB1234', 'car')
      `, [testUserId]);
      expect.fail('Should have failed unique constraint');
    } catch (e: any) {
      expect(e.code).toBe('23505'); // unique_violation
    }
  });

  it('rejects booking with end_time <= start_time via CHECK constraint (23514)', async () => {
    const t = new Date();
    const tStart = new Date(t.getTime() + 3600000);
    const tEnd = new Date(t.getTime() + 1800000); // end before start

    try {
      await client.query(`
        INSERT INTO bookings (user_id, vehicle_id, slot_id, start_time, end_time, status, amount, expires_at)
        VALUES ($1, $2, $3, $4, $5, 'held', 50.00, now() + interval '10 minutes')
      `, [testUserId, testVehicleId, testSlotId, tStart, tEnd]);
      expect.fail('Should have failed time order check');
    } catch (e: any) {
      expect(e.code).toBe('23514'); // check_violation
    }
  });

  it('successfully creates a valid booking range', async () => {
    const now = new Date();
    const start1 = new Date(now.getTime() + 10 * 3600000);
    const end1 = new Date(now.getTime() + 12 * 3600000);

    const res = await client.query(`
      INSERT INTO bookings (user_id, vehicle_id, slot_id, start_time, end_time, status, amount, expires_at)
      VALUES ($1, $2, $3, $4, $5, 'held', 100.00, now() + interval '10 minutes')
      RETURNING booking_id
    `, [testUserId, testVehicleId, testSlotId, start1, end1]);

    expect(res.rows[0].booking_id).toBeDefined();
  });

  it('rejects overlapping booking on the same slot via GiST exclusion constraint (23P01)', async () => {
    const now = new Date();
    // Overlaps with 10h to 12h: (11h to 13h)
    const start2 = new Date(now.getTime() + 11 * 3600000);
    const end2 = new Date(now.getTime() + 13 * 3600000);

    try {
      await client.query(`
        INSERT INTO bookings (user_id, vehicle_id, slot_id, start_time, end_time, status, amount, expires_at)
        VALUES ($1, $2, $3, $4, $5, 'held', 100.00, now() + interval '10 minutes')
      `, [testUserId, testVehicleId, testSlotId, start2, end2]);
      expect.fail('Should have failed exclusion constraint');
    } catch (e: any) {
      expect(e.code).toBe('23P01'); // exclusion_violation
    }
  });

  it('accepts back-to-back booking where previous end equals new start [) boundary', async () => {
    const now = new Date();
    // Previous booking ends at 12h; new booking starts exactly at 12h: (12h to 14h)
    const start3 = new Date(now.getTime() + 12 * 3600000);
    const end3 = new Date(now.getTime() + 14 * 3600000);

    const res = await client.query(`
      INSERT INTO bookings (user_id, vehicle_id, slot_id, start_time, end_time, status, amount, expires_at)
      VALUES ($1, $2, $3, $4, $5, 'held', 100.00, now() + interval '10 minutes')
      RETURNING booking_id
    `, [testUserId, testVehicleId, testSlotId, start3, end3]);

    expect(res.rows[0].booking_id).toBeDefined();
  });
});
