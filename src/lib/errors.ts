import { ZodError } from 'zod';

export class AppError extends Error { constructor(public code: string, public status = 400) { super(code); } }
const known: Record<string, [number, string]> = {
  '23P01': [409, 'SLOT_TAKEN'], '23505': [409, 'DUPLICATE'], '23503': [409, 'IN_USE'], '23514': [422, 'INVALID_VALUE'], '42501': [403, 'FORBIDDEN'],
  NOT_AUTHENTICATED: [401, 'NOT_AUTHENTICATED'], VEHICLE_NOT_OWNED: [422, 'VEHICLE_NOT_OWNED'], SLOT_NOT_BOOKABLE: [422, 'SLOT_NOT_BOOKABLE'],
  SLOT_TYPE_MISMATCH: [422, 'SLOT_TYPE_MISMATCH'], START_IN_PAST: [422, 'START_IN_PAST'], TOO_SHORT: [422, 'TOO_SHORT'], ROLE_NOT_ALLOWED: [422, 'ROLE_NOT_ALLOWED'],
  BOOKING_NOT_FOUND: [404, 'BOOKING_NOT_FOUND'], NOT_FOUND: [404, 'NOT_FOUND'], HOLD_EXPIRED: [410, 'HOLD_EXPIRED'], PAYMENT_FAILED: [402, 'PAYMENT_FAILED'], NO_COMPLETED_BOOKING: [422, 'NO_COMPLETED_BOOKING'],
  BOOKING_NOT_PAYABLE: [409, 'BOOKING_NOT_PAYABLE'], NOT_CANCELLABLE: [409, 'NOT_CANCELLABLE'], TOO_EARLY: [409, 'TOO_EARLY'], EXPIRED_WINDOW: [409, 'EXPIRED_WINDOW'], NOT_CHECKED_IN: [409, 'NOT_CHECKED_IN'],
};
export function errorResponse(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: 'VALIDATION', fields: error.flatten() }, { status: 400 });
  const e = error as { code?: string; message?: string };
  if (e?.code?.startsWith('22')) return Response.json({ error: 'INVALID_VALUE' }, { status: 422 });
  const [status, code] = known[e?.code || ''] || known[e?.message || ''] || [500, 'INTERNAL_ERROR'];
  if (status === 500) console.error('Request failed:', e);
  return Response.json({ error: code }, { status });
}
export function originAllowed(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || new URL(origin).host === new URL(request.url).host;
}
