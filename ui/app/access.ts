import type { FamilySummary, Me, Permission, ProblemCode } from '../lib/api/generated/members';

// What the UI may show; the BFF enforces the same permissions, so this only hides what would fail.
// Checks always name a permission, never a role. `/me` holds the permissions outside any family,
// the open family the caller's permissions in it.
export function can(me: Me | null, permission: Permission, family?: Pick<FamilySummary, 'permissions'> | null) {
  if (!me) return false;
  return me.permissions.includes(permission) || !!family?.permissions.includes(permission);
}

// The BFF's MAX_OWNED_TREES: non-admins own at most this many families outside the trash.
export const MAX_OWNED_FAMILIES = 5;

// Whether creating or importing a family would hit that limit; the list holds no trashed families, like the BFF's count.
export function atFamilyLimit(me: Me | null, families: Pick<FamilySummary, 'role'>[] | null) {
  if (!me || me.admin || !families) return false;
  return families.filter((family) => family.role === 'owner').length >= MAX_OWNED_FAMILIES;
}

// Without `tree.appearance` only the experimental appearance is available; any other stored choice falls back to it.
export const APPEARANCES = ['organic', 'organicExperimental', 'experimental'] as const;
export type Appearance = (typeof APPEARANCES)[number];
export const PUBLIC_APPEARANCE: Appearance = 'experimental';

// The design theme of an appearance; the organic appearances are 3D, the experimental one is TRON.
export type Theme = '3d' | 'tron';

export function themeOf(appearance: Appearance): Theme {
  return appearance === 'experimental' ? 'tron' : '3d';
}

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

// The host (with its port) of a configured address such as `ADMIN_URL`, lowercased; null when unset or not a URL.
export function hostOf(url: string | undefined): string | null {
  try {
    return url?.trim() ? new URL(url.trim()).host.toLowerCase() : null;
  } catch {
    return null;
  }
}
