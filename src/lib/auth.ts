import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

const secret = new TextEncoder().encode(env.JWT_SECRET);
export type Session = { id: number; role: 'customer' | 'owner' | 'staff' | 'admin'; name: string };
export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export async function signSession(session: Session) {
  return new SignJWT({ role: session.role, name: session.name }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(session.id)).setIssuedAt().setExpirationTime('2h').sign(secret);
}
export async function verifySession(token: string): Promise<Session | null> {
  try { const { payload } = await jwtVerify(token, secret); const id = Number(payload.sub); const role = payload.role; if (!Number.isInteger(id) || !['customer','owner','staff','admin'].includes(String(role)) || typeof payload.name !== 'string') return null; return { id, role: role as Session['role'], name: payload.name }; }
  catch { return null; }
}
