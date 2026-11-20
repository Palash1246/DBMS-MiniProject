import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

async function verifyEdgeToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch { return null; }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const section = path.split('/')[1];
  const required: Record<string, string> = { owner: 'owner', staff: 'staff', admin: 'admin', vehicles: 'customer', bookings: 'customer', search: 'customer' };
  const role = required[section];
  if (!role) return NextResponse.next();
  const token = request.cookies.get('ps_session')?.value;
  const sessionRole = token ? await verifyEdgeToken(token) : null;
  if (!sessionRole) return NextResponse.redirect(new URL('/login', request.url));
  if (sessionRole !== role) return NextResponse.redirect(new URL('/', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/owner/:path*', '/staff/:path*', '/admin/:path*', '/vehicles/:path*', '/bookings/:path*', '/search/:path*'] };
