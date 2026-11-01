import { hostOf } from './access.ts';

// What `proxy.ts` does with a request: let it through, send it to the admin page, hide it, or send `/` to the landing page.
export type HostDecision = { kind: 'next' } | { kind: 'toAdmin'; url: string } | { kind: 'notFound' } | { kind: 'toHome' };

// The public landing page and its example family; the administration's host has no use for them.
export function isLandingPath(pathname: string) {
  return pathname === '/' || pathname === '/home' || pathname.startsWith('/home/');
}

export function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

// With the administration on its own host (`adminUrl`), that host opens on `/admin` instead of the landing page, and the
// tree's host has no `/admin`; every other path, trees and legal pages included, stays reachable on both. Unset, both live
// together. `host` is the request's `Host` header.
export function hostDecision(adminUrl: string | undefined, host: string | null, pathname: string): HostDecision {
  const toHome: HostDecision = pathname === '/' ? { kind: 'toHome' } : { kind: 'next' };
  const adminHost = hostOf(adminUrl);
  if (!adminUrl || !adminHost) return toHome;
  const onAdminHost = host?.toLowerCase() === adminHost;
  if (onAdminHost && isLandingPath(pathname)) return { kind: 'toAdmin', url: `${adminUrl.trim().replace(/\/+$/, '')}/admin` };
  if (!onAdminHost && isAdminPath(pathname)) return { kind: 'notFound' };
  return onAdminHost ? { kind: 'next' } : toHome;
}
