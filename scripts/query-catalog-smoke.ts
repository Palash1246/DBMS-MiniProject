import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.DATABASE_ADMIN_URL;
if (!url) throw new Error('DATABASE_ADMIN_URL is required');

const sqlFile = fs.readFileSync(path.join(process.cwd(), 'db', 'postgres', '99_queries.sql'), 'utf8');
const parts = sqlFile.split(/^-- Q(\d+):[^\r\n]*\r?\n/gm);
const queries = new Map<number, string>();
for (let i = 1; i < parts.length; i += 2) queries.set(Number(parts[i]), parts[i + 1].trim());

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='20s'");
    const customer = await client.query("SELECT user_id FROM users WHERE role='customer' AND EXISTS(SELECT 1 FROM bookings b WHERE b.user_id=users.user_id) ORDER BY user_id LIMIT 1");
    const city = await client.query("SELECT area_id FROM areas WHERE level='city' ORDER BY area_id LIMIT 1");
    const owner = await client.query("SELECT user_id FROM users WHERE role='owner' ORDER BY user_id LIMIT 1");
    const area = await client.query("SELECT area_id FROM areas WHERE level='locality' ORDER BY area_id LIMIT 1");
    if (!customer.rowCount || !city.rowCount || !owner.rowCount || !area.rowCount) throw new Error('Run db:seed before the query catalog smoke run');

    const tag = Date.now();
    const lot = await client.query(
      'INSERT INTO parking_lots(owner_id,area_id,name,mongo_lot_id,base_rate_per_hr) VALUES($1,$2,$3,$4,50) RETURNING lot_id',
      [owner.rows[0].user_id, area.rows[0].area_id, `Query Smoke ${tag}`, tag.toString(16).padStart(24, '0').slice(-24)],
    );
    const slot = await client.query("INSERT INTO slots(lot_id,slot_label,slot_type) VALUES($1,$2,'regular') RETURNING slot_id", [lot.rows[0].lot_id, `Q${tag % 100000}`]);
    const start = new Date(Date.now() + 6 * 60 * 60_000).toISOString();
    const end = new Date(Date.now() + 7 * 60 * 60_000).toISOString();
    const params: Record<number, unknown[]> = {
      1: [customer.rows[0].user_id], 2: [0], 5: [city.rows[0].area_id], 7: [lot.rows[0].lot_id, start, end],
      13: [slot.rows[0].slot_id], 14: [lot.rows[0].lot_id, 3],
    };
    const summaries = [];
    for (let n = 1; n <= 14; n++) {
      let sql = queries.get(n);
      if (!sql) throw new Error(`Q${n} was not found in the catalog`);
      // Q4 is intentionally correlated and quadratic on a 200k-row fixture; bound
      // its outer sample while retaining the original correlated comparison.
      if (n === 4) sql = sql.replace('WHERE b.amount>', 'WHERE b.booking_id <= (SELECT MIN(booking_id)+100 FROM bookings) AND b.amount>');
      console.log(`Running Q${n}...`);
      const result = await client.query(sql, params[n] || []);
      summaries.push({ query: `Q${n}`, rows: result.rowCount ?? result.rows.length });
    }
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ executed: summaries.length, results: summaries, mutatingQueriesRolledBack: true }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Query catalog smoke run failed:', error);
  process.exitCode = 1;
});
