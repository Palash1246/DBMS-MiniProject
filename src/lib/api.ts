import { cookies } from 'next/headers';
import { verifySession, type Session } from './auth';
export async function apiSession(role?: Session['role']) {
  const token = (await cookies()).get('ps_session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return { session: null, response: Response.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 }) };
  if (role && session.role !== role) return { session: null, response: Response.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  return { session, response: null };
}
