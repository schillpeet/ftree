'use client';

import { useEffect, useState } from 'react';
import type { Role } from '../lib/api/generated/members';

// Mirrors `GET /me/invitations` of the BFF: the invitations to trees the signed-in person received. Swap it for the
// generated client once the endpoint is part of `api/openapi.yaml`.
export type MyInvitation = {
  email: string;
  familyId: string;
  familyName: string;
  role: Exclude<Role, 'admin'>;
  // ISO date-time.
  invitedAt: string;
  status: 'pending' | 'accepted';
};

// Pending invitations first, then accepted ones; each group keeps the newest first.
export function sortInvitations(invitations: MyInvitation[]): MyInvitation[] {
  const rank = (invitation: MyInvitation) => (invitation.status === 'pending' ? 0 : 1);
  return [...invitations].sort((a, b) => rank(a) - rank(b) || b.invitedAt.localeCompare(a.invitedAt));
}

// null while loading and when the endpoint is missing or failing, so the section can hide itself.
export function useMyInvitations(enabled: boolean): MyInvitation[] | null {
  const [invitations, setInvitations] = useState<MyInvitation[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    fetch('/api/me/invitations', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<MyInvitation[]>) : null))
      .then((body) => {
        if (current && Array.isArray(body)) setInvitations(sortInvitations(body));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [enabled]);
  return invitations;
}
