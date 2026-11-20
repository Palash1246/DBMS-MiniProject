import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { withDb } from '@/lib/pg';
import { apiSession } from '@/lib/api';
import { getMongoDb } from '@/lib/mongo';
import { errorResponse, originAllowed } from '@/lib/errors';

export const dynamic = 'force-dynamic';
const amenity = z.enum(['covered','ev_charging','cctv','valet','washroom','security_guard','lift_access']);
const photoSchema = z.object({ url: z.string().url(), caption: z.string().max(200) });
const ruleSchema = z.object({ day_type: z.enum(['weekday','weekend']), from_hour: z.number().int().min(0).max(23), to_hour: z.number().int().min(0).max(23), rate_multiplier: z.number().min(0.5).max(3) });

async function profileId(user: { id: number; role: 'customer'|'owner'|'staff'|'admin' }, lotId: number) {
  const lot = await withDb(user, async c => (await c.query('SELECT mongo_lot_id FROM parking_lots WHERE lot_id=$1', [lotId])).rows[0]);
  if (!lot) throw Object.assign(new Error('FORBIDDEN'), { code: '42501' });
  return new ObjectId(lot.mongo_lot_id);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await apiSession('owner'); if (response || !session) return response;
  try { const oid = await profileId(session, Number((await params).id)); const profile = await (await getMongoDb()).collection('lot_profiles').findOne({ _id: oid }); return profile ? Response.json({ profile }) : Response.json({ error: 'NOT_FOUND' }, { status: 404 }); }
  catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await apiSession('owner'); if (response || !session) return response;
  if (!originAllowed(request)) return Response.json({ error: 'BAD_ORIGIN' }, { status: 403 });
  try {
    const body = z.object({
      description: z.string().max(2000).optional(), height_limit_m: z.number().min(1.5).max(5).nullable().optional(),
      address: z.object({ line1: z.string().max(200).optional(), locality: z.string().min(2).max(80).optional(), pincode: z.string().regex(/^560[0-9]{3}$/).optional() }).optional(),
      operating_hours: z.object({ open_24x7: z.boolean(), open: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional(), close: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional() }).optional(),
      amenity: amenity.optional(), amenity_op: z.enum(['add','remove']).optional(), photo: photoSchema.optional(), photo_op: z.enum(['add','remove']).optional(),
      pricing_rule: ruleSchema.optional(), pricing_rule_op: z.enum(['add','remove','update']).optional(),
    }).parse(await request.json());
    const oid = await profileId(session, Number((await params).id));
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (body.description !== undefined) set.description = body.description;
    if (body.height_limit_m !== undefined) set.height_limit_m = body.height_limit_m;
    for (const [k,v] of Object.entries(body.address || {})) set[`address.${k}`] = v;
    for (const [k,v] of Object.entries(body.operating_hours || {})) set[`operating_hours.${k}`] = v;
    const update: Record<string, unknown> = { $set: set };
    if (body.amenity && body.amenity_op) update[body.amenity_op === 'add' ? '$addToSet' : '$pull'] = { amenities: body.amenity };
    if (body.photo && body.photo_op) update[body.photo_op === 'add' ? '$push' : '$pull'] = { photos: body.photo };
    const options: Record<string, unknown> = {};
    if (body.pricing_rule && body.pricing_rule_op === 'add') update.$addToSet = { ...(update.$addToSet as object || {}), pricing_rules: body.pricing_rule };
    if (body.pricing_rule && body.pricing_rule_op === 'remove') update.$pull = { ...(update.$pull as object || {}), pricing_rules: body.pricing_rule };
    if (body.pricing_rule && body.pricing_rule_op === 'update') { set['pricing_rules.$[rule].rate_multiplier'] = body.pricing_rule.rate_multiplier; options.arrayFilters = [{ 'rule.day_type': body.pricing_rule.day_type }]; }
    await (await getMongoDb()).collection('lot_profiles').updateOne({ _id: oid }, update, options);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await apiSession('owner'); if (response || !session) return response;
  if (!originAllowed(request)) return Response.json({ error: 'BAD_ORIGIN' }, { status: 403 });
  try {
    const body = z.object({ photo: photoSchema.optional(), pricing_rule: ruleSchema.optional() }).refine(v => Boolean(v.photo || v.pricing_rule)).parse(await request.json());
    const oid = await profileId(session, Number((await params).id)); const pull: Record<string, unknown> = {};
    if (body.photo) pull.photos = body.photo; if (body.pricing_rule) pull.pricing_rules = body.pricing_rule;
    await (await getMongoDb()).collection('lot_profiles').updateOne({ _id: oid }, { $pull: pull as never, $set: { updated_at: new Date() } });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
