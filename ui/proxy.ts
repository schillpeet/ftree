import { NextResponse, type NextRequest } from 'next/server';
import { hostOf } from './app/access';

// With the administration on its own host (`ADMIN_URL`), that host opens on `/admin` and the tree's host has no `/admin`
// at all; trees stay reachable on the admin host, which is where admins open them. Unset, as locally, both live together.
// The BFF decides the rights either way; this only keeps each host to what it is for.
export function proxy(request: NextRequest) {
  const adminUrl = process.env.ADMIN_URL;
  const adminHost = hostOf(adminUrl);
  if (!adminUrl || !adminHost) return NextResponse.next();
  const onAdminHost = request.headers.get('host')?.toLowerCase() === adminHost;
  const adminPath = request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/');
  if (onAdminHost && !adminPath) return NextResponse.redirect(`${adminUrl.trim().replace(/\/+$/, '')}/admin`);
  if (!onAdminHost && adminPath) return new NextResponse('Not found', { status: 404 });
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin', '/admin/:path*'],
};
