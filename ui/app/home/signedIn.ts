'use client';

import { useEffect, useState } from 'react';
import type { Me } from '../../lib/api/generated/members';

// Whether the probed visitor holds the developer tools; these pages have no `useCan`.
export function hasDevTools(me: Me | null | undefined) {
  return !!me?.permissions.includes('dev.tools');
}

// Who the visitor is, from a quiet `/me` probe: signed out, Cloudflare Access answers with a redirect to its sign-in
// page (or the call fails), which counts as nobody (null). Undefined while the probe runs, so the pages show neither
// "Sign in" nor the signed-in name until they know. Deliberately not the tree's `PermissionsProvider`, whose fetch
// wrapper would show an auth banner to anonymous visitors.
export function useSignedIn(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    fetch('/api/me', { redirect: 'manual', cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<Me>) : null))
      .then((body) => {
        if (current) setMe(body);
      })
      .catch(() => {
        if (current) setMe(null);
      });
    return () => {
      current = false;
    };
  }, []);
  return me;
}
