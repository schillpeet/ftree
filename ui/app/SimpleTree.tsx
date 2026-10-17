'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { Member } from '../lib/api/generated/members';
import { relationLines } from './familyLayout';
import { generations } from './generations';
import { useT } from './i18n';
import { isNameless, nameOf, shortFirstName } from './names';
import type { Point } from './pins';
import { NAME_GAP, simpleLayout } from './simpleLayout';

const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

// The lowest row floats this far above the floor.
const LIFT = 2;
const NAME_SCALE = 50;
// Someone with children by several partners forks this far toward each partner.
const FORK = NAME_GAP / 4;

// The experimental view's family tree: names floating on one row per generation, joined by plain
// lines and rings, at positions that follow from the relations alone. `facing` turns it toward the camera.
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
  const t = useT();
  const positions = useMemo(() => simpleLayout(members, generations(members)), [members]);
  const links = useMemo(() => relationLines(members, positions, ([x]) => x, FORK), [members, positions]);
  // Partners are marked by two rings between their names instead of a line.
  const rings = members.flatMap((m) =>
    m.partnerIds
      .filter((id) => id > m.id && positions.has(id))
      .filter((id) => !m.partnerships.some((p) => p.partnerId === id && p.status === 'separated'))
      .map((id) => [m.id, id] as const),
  );
  return (
    <group position={[0, base + LIFT, 0]} rotation-y={Math.PI / 2 - facing}>
      {links.parents.length > 0 && <Line points={links.parents} segments color="#00e5ff" lineWidth={2} />}
      {links.dashed.length > 0 && (
        <Line points={links.dashed} segments dashed dashSize={0.6} gapSize={0.5} color="#00e5ff" lineWidth={2} />
      )}
      {rings.map(([a, b]) => (
        <Html key={`${a}-${b}`} position={midpoint(positions.get(a)!, positions.get(b)!)} center distanceFactor={NAME_SCALE}>
          <span className="simple-rings" aria-hidden>
            ⚭
          </span>
        </Html>
      ))}
      {members.map((member) => (
        // Labels scale with the distance like the rest of the scene, so the gaps between them hold.
        <Html key={member.id} position={positions.get(member.id)} center distanceFactor={NAME_SCALE}>
          <button className="simple-name" type="button" title={nameOf(member, t.members.unknown)} onClick={() => onOpen(member.id)}>
            {isNameless(member) ? t.members.unknown : <>{shortFirstName(member.firstName)}<br />{member.lastName}</>}
          </button>
        </Html>
      ))}
    </group>
  );
}
