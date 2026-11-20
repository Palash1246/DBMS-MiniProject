import { withDb } from '@/lib/pg';
import { apiSession } from '@/lib/api';
import { vehicleSchema } from '@/lib/validators';
import { errorResponse, originAllowed } from '@/lib/errors';
export const dynamic = 'force-dynamic';
export async function GET() { const { session, response } = await apiSession('customer'); if (response || !session) return response; try { const rows = await withDb(session, async c => (await c.query('SELECT vehicle_id, reg_number, vehicle_type FROM vehicles ORDER BY vehicle_id')).rows); return Response.json({ vehicles: rows }); } catch (e) { return errorResponse(e); } }
export async function POST(request: Request) { const { session, response } = await apiSession('customer'); if (response || !session) return response; if (!originAllowed(request)) return Response.json({ error: 'BAD_ORIGIN' }, { status: 403 }); try { const v = vehicleSchema.parse(await request.json()); const row = await withDb(session, async c => (await c.query('INSERT INTO vehicles(user_id,reg_number,vehicle_type) VALUES($1,$2,$3) RETURNING vehicle_id,reg_number,vehicle_type', [session.id, v.reg_number, v.vehicle_type])).rows[0]); return Response.json({ vehicle: row }, { status: 201 }); } catch (e) { return errorResponse(e); } }
