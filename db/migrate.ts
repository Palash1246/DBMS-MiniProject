import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;

async function migrate() {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) {
    console.error('❌ DATABASE_ADMIN_URL environment variable is required for migration.');
    process.exit(1);
  }

  const appPassword = process.env.PS_APP_PASSWORD || 'change_me_app';
  const isReset = process.argv.includes('--reset');
  const withDemo = process.argv.includes('--with-demo');

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  console.log(`🔌 Connected to PostgreSQL as admin (${client.database})`);

  try {
    if (isReset) {
      console.log('🔄 Resetting public and demo schemas...');
      await client.query(`
        DROP SCHEMA IF EXISTS demo CASCADE;
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
      `);
      console.log('✅ Schemas reset.');
    }

    const sqlDir = path.join(process.cwd(), 'db', 'postgres');
    const files = fs.readdirSync(sqlDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (file === '99_queries.sql') continue;
      if (file === '02_ddl_demo.sql' && !withDemo) continue;

      const filePath = path.join(sqlDir, file);
      console.log(`▶️ Executing ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await client.query(sql);

      // After 00_roles_extensions.sql, set the password for ps_app dynamically using escapeLiteral
      if (file === '00_roles_extensions.sql') {
        const escaped = client.escapeLiteral(appPassword);
        await client.query(`ALTER ROLE ps_app WITH PASSWORD ${escaped};`);
        console.log('🔑 Role ps_app password set securely.');
      }
      console.log(`✅ ${file} applied.`);
    }

    console.log('🎉 PostgreSQL migrations completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();

