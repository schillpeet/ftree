'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { Member } from '../lib/api/generated/members';
import { relationLines } from './familyLayout';
import { generations } from './generations';
import { simpleLayout } from './simpleLayout';

// The lowest row floats this far above the floor.
const LIFT = 2;
const NAME_SCALE = 50;

// The experimental view's family tree: names floating on one row per generation, joined by plain
// lines, at positions that follow from the relations alone. `facing` turns it toward the camera.
export default function SimpleTree({
  members,
  base,
  facing,
  onOpen,
}: {
  members: Member[];
  base: number;
  facing: number;
  onOpen: (id: string) => void;
}) {
  const positions = useMemo(() => simpleLayout(members, generations(members)), [members]);
  const links = useMemo(() => relationLines(members, positions, ([x]) => x), [members, positions]);
  return (
    <group position={[0, base + LIFT, 0]} rotation-y={Math.PI / 2 - facing}>
      {links.parents.length > 0 && <Line points={links.parents} segments color="#00e5ff" lineWidth={2} />}
      {links.partners.length > 0 && <Line points={links.partners} segments color="#9ff6ff" lineWidth={3} />}
      {members.map((member) => (
        // Labels scale with the distance like the rest of the scene, so the gaps between them hold.
        <Html key={member.id} position={positions.get(member.id)} center distanceFactor={NAME_SCALE}>
          <button className="simple-name" type="button" onClick={() => onOpen(member.id)}>
            {member.firstName}
            <br />
            {member.lastName}
          </button>
        </Html>
      ))}
    </group>
  );
}
