import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, type Session } from './auth';

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get('ps_session')?.value;
  return token ? verifySession(token) : null;
}
export async function requireRole(...roles: Session['role'][]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!roles.includes(session.role)) redirect('/');
  return session;
}
