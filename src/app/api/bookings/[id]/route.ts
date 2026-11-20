import { withDb } from '@/lib/pg'; import { apiSession } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) { const {session,response}=await apiSession('customer'); if(response||!session)return response; const {id}=await params; const booking=await withDb(session,async c=>(await c.query('SELECT * FROM v_my_bookings WHERE booking_id=$1',[Number(id)])).rows[0]); return booking?Response.json({booking}):Response.json({error:'NOT_FOUND'},{status:404}); }
