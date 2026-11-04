'use client';

import { createContext, useContext } from 'react';
import type { Member } from '../lib/api/generated/members';
import { useT } from './i18n';
import { displayName } from './names';

// The shown family's members, so a placeholder anywhere in the panels can be named by its role in the tree.
const MembersContext = createContext<Member[]>([]);
export const MembersProvider = MembersContext.Provider;

// The name to show for a member: theirs, or for a placeholder their role ("Elternteil", "Kind", …).
export function useDisplayName() {
  const t = useT();
  const members = useContext(MembersContext);
  return (member: Member) => displayName(member, members, t.placeholder.role);
}
