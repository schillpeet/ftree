import { NextResponse, type NextRequest } from 'next/server';
import { hostDecision } from './app/adminHost';

// With the administration on its own host (`ADMIN_URL`), that host opens on `/admin` and shows neither the landing page
// (`/`, `/home`) nor anything else public; the tree's host has no `/admin` at all. Trees stay reachable on the admin host,
// which is where admins open them. Unset, as locally, both live together.
// The BFF decides the rights either way; this only keeps each host to what it is for.
// On the tree's host `/` is the landing page at `/home`, which like every page but the legal ones sits behind
// Cloudflare Access; from there people go on to `/start`. `/login` leads there too: it exists to be behind Access, so
// that "Sign in" ends on the landing page and not in a tree.
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
  matcher: ['/', '/login', '/home', '/home/:path*', '/admin', '/admin/:path*'],
};
