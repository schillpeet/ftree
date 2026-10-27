import type { FamilySummary, Me, Permission, ProblemCode } from '../lib/api/generated/members';

// What the UI may show; the BFF enforces the same permissions, so this only hides what would fail.
// Checks always name a permission, never a role. `/me` holds the permissions outside any family,
// the open family the caller's permissions in it.
export function can(me: Me | null, permission: Permission, family?: Pick<FamilySummary, 'permissions'> | null) {
  if (!me) return false;
  return me.permissions.includes(permission) || !!family?.permissions.includes(permission);
}

// Without `tree.appearance` only the experimental appearance is available; any other stored choice falls back to it.
export const APPEARANCES = ['organic', 'organicExperimental', 'experimental'] as const;
export type Appearance = (typeof APPEARANCES)[number];
export const PUBLIC_APPEARANCE: Appearance = 'experimental';

// `mayChoose` is null while `/me` is still loading; the stored choice is kept meanwhile, so the
// tree does not switch appearance once the permissions arrive.
export function allowedAppearance(saved: string | null, mayChoose: boolean | null): Appearance {
  if (mayChoose === false) return PUBLIC_APPEARANCE;
  return APPEARANCES.includes(saved as Appearance) ? (saved as Appearance) : 'organic';
}

// FORBIDDEN: signed in, but the role does not allow it. UNAUTHENTICATED: no (valid) sign-in, e.g. an expired Access session.
export type AuthProblem = 'forbidden' | 'signedOut';

// Only responses of this app's own `/api/*` proxy count; `origin` is the page's origin. The BFF's answers carry a
// problem code; an answer without one did not come from the BFF (Cloudflare Access, the proxy), so only there the
// status decides.
export function authProblemOf(url: string, status: number, code: ProblemCode | null, origin: string): AuthProblem | null {
  if (!isApiUrl(url, origin)) return null;
  if (code === 'FORBIDDEN' || (code === null && status === 403)) return 'forbidden';
  if (code === 'UNAUTHENTICATED' || (code === null && status === 401)) return 'signedOut';
  return null;
}

// A failed `/api/*` call (a network error, not an answer) is probed with `/api/me` without following redirects. Cloudflare
// Access answers an ended or revoked session with a redirect to its sign-in page on another origin, which `fetch` can only
// report as a network error; the probe tells that apart from the network being down.
export function failedCallNeedsProbe(url: string, origin: string) {
  return isApiUrl(url, origin);
}

export function signedOutByProbe(type: ResponseType) {
  return type === 'opaqueredirect';
}

function isApiUrl(url: string, origin: string) {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}
