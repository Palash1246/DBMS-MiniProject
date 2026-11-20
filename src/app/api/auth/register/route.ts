import { withApp } from '@/lib/pg';
import { hashPassword, signSession } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';
import { errorResponse, originAllowed } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!originAllowed(request)) return Response.json({ error: 'BAD_ORIGIN' }, { status: 403 });
  try {
    const input = registerSchema.parse(await request.json());
    const hash = await hashPassword(input.password);
    const user = await withApp(async c => (await c.query('SELECT fn_register_user($1,$2,$3,$4,$5) AS user_id', [input.name, input.email, input.phone, hash, input.role])).rows[0]);
    const id = Number(user.user_id);
    const token = await signSession({ id, role: input.role, name: input.name });
    const response = Response.json({ user: { id, role: input.role, name: input.name } }, { status: 201 });
    response.headers.append('Set-Cookie', `ps_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return response;
  } catch (error) { return errorResponse(error); }
}
