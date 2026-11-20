import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;

describe('booking exclusion under concurrent requests', () => {
  let setup: pg.Client;
  let lotId: number;
  let slotIds: number[] = [];
  let userIds: number[] = [];
  let vehicleIds: number[] = [];
  let ownerId: number;

  beforeAll(async () => {
    const url = process.env.DATABASE_ADMIN_URL;
    if (!url) throw new Error('DATABASE_ADMIN_URL is required for concurrency tests');
    setup = new Client({ connectionString: url });
    await setup.connect();

    const tag = Date.now();
    const city = await setup.query("SELECT area_id FROM areas WHERE level='city' ORDER BY area_id LIMIT 1");
    const area = await setup.query(
      "INSERT INTO areas(name,level,parent_area_id) VALUES($1,'locality',$2) RETURNING area_id",
      [`Concurrent Test ${tag}`, city.rows[0].area_id],
    );
    const owner = await setup.query(
      "INSERT INTO users(name,email,phone,password_hash,role) VALUES('Concurrent Owner',$1,$2,'test-hash','owner') RETURNING user_id",
      [`concurrency-owner-${tag}@test.parksmart`, `+9199${String(tag).slice(-8)}`],
    );
    ownerId = owner.rows[0].user_id;
    const lot = await setup.query(
      'INSERT INTO parking_lots(owner_id,area_id,name,mongo_lot_id,base_rate_per_hr) VALUES($1,$2,$3,$4,50) RETURNING lot_id',
      [ownerId, area.rows[0].area_id, `Concurrent Test Lot ${tag}`, String(tag).padStart(24, '0')],
    );
    lotId = lot.rows[0].lot_id;

    for (let i = 0; i < 20; i++) {
      const suffix = `${tag}-${i}`;
      const user = await setup.query(
        "INSERT INTO users(name,email,phone,password_hash,role) VALUES($1,$2,$3,'test-hash','customer') RETURNING user_id",
        [`Concurrent Customer ${i}`, `concurrency-${suffix}@test.parksmart`, `+9198${String(tag + i).slice(-8)}`],
      );
      const userId = user.rows[0].user_id as number;
      userIds.push(userId);
      const vehicle = await setup.query(
        'INSERT INTO vehicles(user_id,reg_number,vehicle_type) VALUES($1,$2,\'car\') RETURNING vehicle_id',
        [userId, `KA${String((i % 99) + 1).padStart(2, '0')}CT${String((tag + i) % 10000).padStart(4, '0')}`],
      );
      vehicleIds.push(vehicle.rows[0].vehicle_id);
      const slot = await setup.query(
        'INSERT INTO slots(lot_id,slot_label,slot_type) VALUES($1,$2,\'regular\') RETURNING slot_id',
        [lotId, `C${String(i).padStart(2, '0')}`],
      );
      slotIds.push(slot.rows[0].slot_id);
    }
  });

  afterAll(async () => {
    if (!setup) return;
    await setup.query("SET session_replication_role='replica'");
    await setup.query('DELETE FROM booking_audit_log WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id = ANY($1::int[]))', [userIds]);
    await setup.query('DELETE FROM payments WHERE booking_id IN (SELECT booking_id FROM bookings WHERE user_id = ANY($1::int[]))', [userIds]);
    await setup.query('DELETE FROM bookings WHERE user_id = ANY($1::int[])', [userIds]);
    await setup.query('DELETE FROM slots WHERE lot_id=$1', [lotId]);
    await setup.query('DELETE FROM parking_lots WHERE lot_id=$1', [lotId]);
    await setup.query('DELETE FROM vehicles WHERE user_id = ANY($1::int[])', [userIds]);
    await setup.query('DELETE FROM users WHERE user_id = ANY($1::int[]) OR user_id=$2', [userIds, ownerId]);
    await setup.query("DELETE FROM areas WHERE name LIKE 'Concurrent Test %'");
    await setup.query("SET session_replication_role='origin'");
    await setup.end();
  });

  async function createHold(i: number, slotId: number, start: Date, end: Date) {
    const url = process.env.DATABASE_ADMIN_URL!;
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ps_customer');
      await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.role','customer',true)", [String(userIds[i])]);
      await client.query('SELECT * FROM sp_create_booking($1,$2,$3,$4)', [vehicleIds[i], slotId, start, end]);
      await client.query('COMMIT');
      return 'accepted' as const;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23P01') return 'conflict' as const;
      throw error;
    } finally {
      await client.end();
    }
  }

  it('accepts only one of 20 overlapping same-slot bookings', async () => {
    const start = new Date(Date.now() + 45 * 60_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    const outcomes = await Promise.all(userIds.map((_, i) => createHold(i, slotIds[0], start, end)));
    expect(outcomes.filter((outcome) => outcome === 'accepted')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === 'conflict')).toHaveLength(19);
  });

  it('accepts simultaneous bookings on different slots', async () => {
    const start = new Date(Date.now() + 4 * 60 * 60_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    const outcomes = await Promise.all(userIds.map((_, i) => createHold(i, slotIds[i], start, end)));
    expect(outcomes.every((outcome) => outcome === 'accepted')).toBe(true);
  });
});
