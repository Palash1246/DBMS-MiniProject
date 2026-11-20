export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return Response.json({ error: 'BAD_ORIGIN' }, { status: 403 });
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `ps_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  return response;
}
