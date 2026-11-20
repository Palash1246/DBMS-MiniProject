import pg, { Pool, PoolClient } from 'pg';
import { appendFileSync } from 'node:fs';
import { env } from './env';

const ROLE_MAP = {
  customer: 'ps_customer',
  owner: 'ps_lot_owner',
  staff: 'ps_staff',
  admin: 'ps_admin',
} as const;

export type AppRole = keyof typeof ROLE_MAP;

function logQuery(query: unknown): void {
  if (process.env.NODE_ENV !== 'development') return;
  const sql = typeof query === 'string'
    ? query
    : query && typeof query === 'object' && 'text' in query && typeof query.text === 'string'
      ? query.text
      : null;
  if (!sql) return;

  const normalizedSql = sql.replace(/\s+/g, ' ').trim();
  if (!normalizedSql) return;
  const line = `[${new Date().toISOString()}] ${normalizedSql}`;
  console.info(`[postgres] ${normalizedSql}`);

  const logPath = process.env.POSTGRES_QUERY_LOG_PATH;
  if (logPath) {
    try {
      appendFileSync(logPath, `${line}\n`, 'utf8');
    } catch (error) {
      console.error('[postgres-log] Could not append the session log:', error);
    }
  }
}

function loggedClient(client: PoolClient): PoolClient {
  return new Proxy(client, {
    get(target, property) {
      if (property === 'query') {
        return (...args: unknown[]) => {
          logQuery(args[0]);
          const query = target.query as unknown as (...queryArgs: unknown[]) => Promise<unknown>;
          return query.apply(target, args);
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

// Setup pg parsers: parse NUMERIC (OID 1700) and BIGINT (OID 20)
pg.types.setTypeParser(1700, (val: string) => parseFloat(val));

declare global {
  var __ps_pg_pool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('connect', (client) => {
    logQuery("SET TIME ZONE 'Asia/Kolkata'");
    client.query("SET TIME ZONE 'Asia/Kolkata'");
  });

  return pool;
}

export const pool: Pool = globalThis.__ps_pg_pool || createPool();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ps_pg_pool = pool;
}

/**
 * Execute queries in a transaction with database-enforced role and session variables.
 * Enforces Row-Level Security (RLS) and SQL permission matrix.
 */
export async function withDb<T>(
  user: { id: number; role: AppRole },
  fn: (c: PoolClient) => Promise<T>
): Promise<T> {
  const client = loggedClient(await pool.connect());
  try {
    await client.query('BEGIN');
    // Whitelisted identifier, never raw user input
    await client.query(`SET LOCAL ROLE ${ROLE_MAP[user.role]}`);
    await client.query(
      `SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true)`,
      [String(user.id), user.role]
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Execute system tasks as ps_app without switching into tenant role (auth lookups, cron sweeps).
 */
export async function withApp<T>(
  fn: (c: PoolClient) => Promise<T>
): Promise<T> {
  const client = loggedClient(await pool.connect());
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

