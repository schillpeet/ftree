'use client';

import { useRef, type PointerEvent } from 'react';
import { Html } from '@react-three/drei';
import type { Member } from '../lib/api/generated/members';
import { formatDate, photoSrc } from './MembersControls';

// Pointer travel (px) up to which a press on a scroll still counts as a click, not a drag.
export const CLICK_TOLERANCE = 5;

// Papyrus scroll in the scene: a DOM card that always faces the camera. Clicking it opens the
// member's profile. A drag that starts on it orbits the camera, or moves the card when `onDrag`
// is set (while the pins are shown).
export default function Scroll({
  member,
  familyId,
  position,
  onOpen,
  onDrag,
}: {
  member: Member;
  familyId: string | null;
  position: [number, number, number];
  onOpen: () => void;
  onDrag?: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  const birth = formatDate(member.birthDate);
  const death = formatDate(member.deathDate);
  const photo = photoSrc(member, familyId);
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  return (
    <Html position={position} transform sprite distanceFactor={8} zIndexRange={[4, 0]}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Profil von ${member.firstName} ${member.lastName} öffnen`}
        className={onDrag ? 'scroll scroll-draggable' : 'scroll'}
        onPointerDown={(event) => {
          pressedAt.current = { x: event.clientX, y: event.clientY };
          if (!onDrag) return; // the camera controls on the canvas container must still see the press
          // Keep the press from the camera controls and from selecting text.
          event.stopPropagation();
          event.preventDefault();
          onDrag(event);
        }}
        onClick={(event) => {
          const start = pressedAt.current;
          pressedAt.current = null;
          // Screen-reader clicks come without a pointerdown.
          if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) <= CLICK_TOLERANCE) onOpen();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onOpen();
        }}
      >
        <div className="scroll-rod" />
        <div className="scroll-sheet">
          {photo && (
            // Arbitrary user URLs: next/image would need every host configured.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="scroll-photo" src={photo} alt="" draggable={false} />
          )}
          <h3>{member.firstName} {member.lastName}</h3>
          {birth && <p>* {birth}</p>}
          {death && <p>† {death}</p>}
          {member.note && <p className="scroll-note">{member.note}</p>}
        </div>
        <div className="scroll-curl" />
      </div>
    </Html>
  );
}
