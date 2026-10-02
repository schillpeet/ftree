'use client';

import { useState } from 'react';
import type { Member } from '../lib/api/generated/members';
import MembersControls from './MembersControls';
import Scene, { type Focus } from './Scene';

// Shares the members between the scene's scrolls and the list/form overlay.
export default function FamilyTree() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  // A new object per click, so clicking the same scroll again reopens the profile.
  const [profile, setProfile] = useState<Focus>(null);

  return (
    <>
      <Scene members={members ?? []} focus={focus} onOpen={(id) => setProfile({ id })} />
      <MembersControls
        members={members}
        setMembers={setMembers}
        profile={profile}
        onSelect={(id) => setFocus({ id })}
      />
    </>
  );
}
