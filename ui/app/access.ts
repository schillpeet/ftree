import type { FamilySummary, Me, Permission } from '../lib/api/generated/members';

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

// 403: signed in, but the role does not allow it. 401: no (valid) sign-in, e.g. an expired Access session.
export type AuthProblem = 'forbidden' | 'signedOut';

// Only responses of this app's own `/api/*` proxy count; `origin` is the page's origin.
export function authProblemOf(url: string, status: number, origin: string): AuthProblem | null {
  if (!isApiUrl(url, origin)) return null;
  if (status === 403) return 'forbidden';
  if (status === 401) return 'signedOut';
  return null;
}

function isApiUrl(url: string, origin: string) {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}
