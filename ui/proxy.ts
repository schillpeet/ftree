import { NextResponse, type NextRequest } from 'next/server';
import { hostOf } from './app/access';

// With the administration on its own host (`ADMIN_URL`), that host opens on `/admin` and the tree's host has no `/admin`
// at all; trees stay reachable on the admin host, which is where admins open them. Unset, as locally, both live together.
// The BFF decides the rights either way; this only keeps each host to what it is for.
// On the tree's host `/` is the public landing page at `/home` (outside Cloudflare Access); signed-in users go on from
// there to `/start`.
export function proxy(request: NextRequest) {
  const adminUrl = process.env.ADMIN_URL;
  const adminHost = hostOf(adminUrl);
  const toHome = () => {
    if (request.nextUrl.pathname !== '/') return NextResponse.next();
    const home = request.nextUrl.clone();
    home.pathname = '/home';
    return NextResponse.redirect(home);
  };
  if (!adminUrl || !adminHost) return toHome();
  const onAdminHost = request.headers.get('host')?.toLowerCase() === adminHost;
  const adminPath = request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/');
  if (onAdminHost && !adminPath) return NextResponse.redirect(`${adminUrl.trim().replace(/\/+$/, '')}/admin`);
  if (!onAdminHost && adminPath) return new NextResponse('Not found', { status: 404 });
  return toHome();
}

export const config = {
  matcher: ['/', '/admin', '/admin/:path*'],
};
