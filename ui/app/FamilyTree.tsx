'use client';

import { useState } from 'react';
import { updateMemberPosition, type Member, type Position } from '../lib/api/generated/members';
import MembersControls from './MembersControls';
import Scene, { type Focus } from './Scene';

// Shares the members between the scene's scrolls and the list/form overlay.
export default function FamilyTree() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const replace = (member: Member) =>
    setMembers((current) => current?.map((m) => (m.id === member.id ? member : m)) ?? null);

  async function moveMember(member: Member, position: Position) {
    setMoveError(null);
    replace({ ...member, position });
    try {
      const response = await updateMemberPosition(member.id, position);
      if (response.status !== 200) throw new Error('Unexpected position response');
      replace(response.data);
    } catch {
      replace(member);
      setMoveError('Die Rolle konnte nicht angepinnt werden. Ist das BFF erreichbar?');
    }
  }

  return (
    <>
      <Scene members={members ?? []} focus={focus} onMove={(member, position) => void moveMember(member, position)} />
      <MembersControls members={members} setMembers={setMembers} onSelect={(id) => setFocus({ id })} />
      {moveError && (
        <p className="scene-error" role="alert">
          {moveError}
          <button type="button" aria-label="Hinweis schließen" onClick={() => setMoveError(null)}>×</button>
        </p>
      )}
    </>
  );
}
