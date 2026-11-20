import { withApp } from '@/lib/pg';
import { signSession, verifyPassword } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';
import { errorResponse, originAllowed } from '@/lib/errors';

export const dynamic = 'force-dynamic';
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  if (!originAllowed(request)) return Response.json({ error: 'BAD_ORIGIN' }, { status: 403 });
  try {
    const input = loginSchema.parse(await request.json());
    const key = `${request.headers.get('x-forwarded-for') || 'local'}:${input.email.toLowerCase()}`;
    const now = Date.now(); const current = attempts.get(key);
    if (current && current.until > now && current.count >= 5) return Response.json({ error: 'TOO_MANY_ATTEMPTS' }, { status: 429 });
    const entry = !current || current.until <= now ? { count: 0, until: now + 60_000 } : current;
    entry.count++; attempts.set(key, entry);
    const row = await withApp(async c => (await c.query('SELECT * FROM fn_auth_lookup($1)', [input.email])).rows[0]);
    if (!row || !(await verifyPassword(input.password, row.o_password_hash))) return Response.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
    attempts.delete(key);
    const user = { id: Number(row.o_user_id), name: row.o_name, role: row.o_role as 'customer' | 'owner' | 'staff' | 'admin' };
    const token = await signSession(user);
    const response = Response.json({ user });
    response.headers.append('Set-Cookie', `ps_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return response;
  } catch (error) { return errorResponse(error); }
}
