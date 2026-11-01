import { NextResponse, type NextRequest } from 'next/server';
import { hostDecision } from './app/adminHost';

// With the administration on its own host (`ADMIN_URL`), that host opens on `/admin` and shows neither the landing page
// (`/`, `/home`) nor anything else public; the tree's host has no `/admin` at all. Trees stay reachable on the admin host,
// which is where admins open them. Unset, as locally, both live together.
// The BFF decides the rights either way; this only keeps each host to what it is for.
// On the tree's host `/` is the public landing page at `/home` (outside Cloudflare Access); signed-in users go on from
// there to `/start`.
export function proxy(request: NextRequest) {
  const decision = hostDecision(process.env.ADMIN_URL, request.headers.get('host'), request.nextUrl.pathname);
  switch (decision.kind) {
    case 'toAdmin':
      return NextResponse.redirect(decision.url);
    case 'notFound':
      return new NextResponse('Not found', { status: 404 });
    case 'toHome': {
      const home = request.nextUrl.clone();
      home.pathname = '/home';
      return NextResponse.redirect(home);
    }
    case 'next':
      return NextResponse.next();
  }
}

export const config = {
  matcher: ['/', '/home', '/home/:path*', '/admin', '/admin/:path*'],
};
