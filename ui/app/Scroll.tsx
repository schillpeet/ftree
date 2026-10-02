'use client';

import { Html } from '@react-three/drei';
import type { PointerEvent } from 'react';
import type { Member } from '../lib/api/generated/members';
import { formatDate } from './MembersControls';

// Papyrus scroll in the scene: a DOM card that always faces the camera.
export default function Scroll({
  member,
  position,
  dragging,
  onGrab,
}: {
  member: Member;
  position: [number, number, number];
  dragging: boolean;
  onGrab: (event: PointerEvent) => void;
}) {
  const birth = formatDate(member.birthDate);
  const death = formatDate(member.deathDate);

  return (
    <Html position={position} transform sprite distanceFactor={8} zIndexRange={[4, 0]}>
      <article
        className={`scroll${dragging ? ' scroll-dragging' : ''}`}
        onPointerDown={onGrab}
        aria-label={`${member.firstName} ${member.lastName}`}
      >
        <div className="scroll-rod" />
        <div className="scroll-sheet">
          {member.photoUrl && (
            // Arbitrary user URLs: next/image would need every host configured.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="scroll-photo" src={member.photoUrl} alt="" draggable={false} />
          )}
          <h3>{member.firstName} {member.lastName}</h3>
          {birth && <p>* {birth}</p>}
          {death && <p>† {death}</p>}
          {member.note && <p className="scroll-note">{member.note}</p>}
        </div>
        <div className="scroll-curl" />
      </article>
    </Html>
  );
}
