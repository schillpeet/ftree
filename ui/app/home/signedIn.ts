'use client';

import { useEffect, useState } from 'react';
import type { Me } from '../../lib/api/generated/members';

// Who the visitor is, from a quiet `/me` probe: signed out, Cloudflare Access answers with a redirect to its sign-in
// page (or the call fails), which counts as nobody. Starts as null, so signed-out visitors see no flicker. Deliberately
// not the tree's `PermissionsProvider`, whose fetch wrapper would show an auth banner to anonymous visitors.
export function useSignedIn(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let current = true;
    fetch('/api/me', { redirect: 'manual', cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<Me>) : null))
      .then((body) => {
        if (current && body) setMe(body);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  return me;
}
