'use client';

import { useState } from 'react';
import type { Member } from '../lib/api/generated/members';
import MembersControls from './MembersControls';
import Scene, { type Focus } from './Scene';

// Shares the members between the scene's scrolls and the list/form overlay.
export default function FamilyTree() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [focus, setFocus] = useState<Focus>(null);

  return (
    <>
      <Scene members={members ?? []} focus={focus} />
      <MembersControls members={members} setMembers={setMembers} onSelect={(id) => setFocus({ id })} />
    </>
  );
}
