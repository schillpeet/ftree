'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { Member } from '../lib/api/generated/members';
import { isFormer, relationLines } from './familyLayout';
import { generations } from './generations';
import { useT } from './i18n';
import { isNameless, nameOf, shortFirstName } from './names';
import type { Point } from './pins';
import { NAME_GAP, simpleLayout } from './simpleLayout';

const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
// How far below a name the rings of a widowed couple sit.
const UNDER_NAME = 1.6;

// The lowest row floats this far above the floor.
const LIFT = 2;
const NAME_SCALE = 50;
// Someone with children by several partners forks this far toward each partner.
const FORK = NAME_GAP / 4;
const FOCUS_COLOR = '#ff4fd8';

// The experimental view's family tree: names floating on one row per generation, joined by plain
// lines and rings, at positions that follow from the relations alone. `facing` turns it toward the camera.
export default function SimpleTree({
  members,
  base,
  facing,
  showLines,
  focusId,
  onOpen,
}: {
  members: Member[];
  base: number;
  facing: number;
  showLines: boolean;
  // Whose lines to their relatives stand out, or null.
  focusId: string | null;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const positions = useMemo(() => simpleLayout(members, generations(members)), [members]);
  const links = useMemo(() => relationLines(members, positions, ([x]) => x, FORK, focusId), [members, positions, focusId]);
  // Partners are marked by two rings between their names instead of a line.
  // A widowed couple's rings sit right under the name of the partner who died: the one with a date of death,
  // else the one with fewer partners (the survivor may have married again). So they never land on whoever
  // stands between the two.
  const byId = new Map(members.map((m) => [m.id, m]));
  const rings = members.flatMap((m) =>
    m.partnerIds
      .filter((id) => id > m.id && positions.has(id))
      .flatMap((id) => {
        const partnership = m.partnerships.find((p) => p.partnerId === id);
        if (partnership && isFormer(partnership.status)) return [];
        const [a, b] = [positions.get(m.id)!, positions.get(id)!];
        const pair = [m, byId.get(id)!];
        const died = pair.filter((who) => who.deathDate);
        const fewer = [...pair].sort((x, y) => x.partnerIds.length - y.partnerIds.length);
        const who =
          died.length === 1 ? died[0] : fewer[0].partnerIds.length < fewer[1].partnerIds.length ? fewer[0] : null;
        const deceased = partnership?.status === 'widowed' && who ? positions.get(who.id)! : null;
        const at: Point = deceased ? [deceased[0], deceased[1] - UNDER_NAME, deceased[2]] : midpoint(a, b);
        return [{ key: `${m.id}-${id}`, at }];
      }),
  );
  return (
    <group position={[0, base + LIFT, 0]} rotation-y={Math.PI / 2 - facing}>
      {showLines && links.parents.length > 0 && <Line points={links.parents} segments color="#00e5ff" lineWidth={2} />}
      {showLines && links.dashed.length > 0 && (
        <Line points={links.dashed} segments dashed dashSize={0.6} gapSize={0.5} color="#00e5ff" lineWidth={2} />
      )}
      {showLines && links.focused.length > 0 && <Line points={links.focused} segments color={FOCUS_COLOR} lineWidth={3} />}
      {showLines && links.focusedDashed.length > 0 && (
        <Line points={links.focusedDashed} segments dashed dashSize={0.6} gapSize={0.5} color={FOCUS_COLOR} lineWidth={3} />
      )}
      {rings.map(({ key, at }) => (
        <Html key={key} position={at} center distanceFactor={NAME_SCALE}>
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
