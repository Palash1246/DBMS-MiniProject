import { env } from '@/lib/env'; import { withApp } from '@/lib/pg';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { if (request.headers.get('x-cron-secret') !== env.CRON_SECRET) return Response.json({ error: 'FORBIDDEN' }, { status: 403 }); try { const result = await withApp(async c => (await c.query('SELECT expire_stale_holds() AS expired')).rows[0].expired); return Response.json({ expired: Number(result) }); } catch (error) { console.error('Expiry request failed:', error); return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 }); } }
