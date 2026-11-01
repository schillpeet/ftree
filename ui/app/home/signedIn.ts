'use client';

import { useEffect, useState } from 'react';

// Whether the visitor is signed in, from a quiet `/me` probe: signed out, Cloudflare Access answers with a redirect to
// its sign-in page (or the call fails), which counts as no. Starts as false, so signed-out visitors see no flicker.
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let current = true;
    fetch('/api/me', { redirect: 'manual', cache: 'no-store' })
      .then((response) => {
        if (current) setSignedIn(response.ok);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  return signedIn;
}
