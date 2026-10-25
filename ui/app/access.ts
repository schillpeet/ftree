import type { Me, Permission } from '../lib/api/generated/members';

// What the UI may show; the BFF enforces the same permissions, so this only hides what would fail.
// Checks always name a permission, never a role.
export function can(me: Me | null, permission: Permission) {
  return !!me?.permissions.includes(permission);
}

// Without `dev.tools` only the experimental appearance is available; any other stored choice falls back to it.
export const APPEARANCES = ['organic', 'organicExperimental', 'experimental'] as const;
export type Appearance = (typeof APPEARANCES)[number];
export const PUBLIC_APPEARANCE: Appearance = 'experimental';

// `devTools` is null while `/me` is still loading; the stored choice is kept meanwhile, so an
// admin's tree does not switch appearance once the permissions arrive.
export function allowedAppearance(saved: string | null, devTools: boolean | null): Appearance {
  if (devTools === false) return PUBLIC_APPEARANCE;
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
