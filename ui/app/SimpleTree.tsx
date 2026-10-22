'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { Member } from '../lib/api/generated/members';
import { buildModel } from './experimental/model';
import { route, type Segment, type XY } from './experimental/routing';
import { useT } from './i18n';
import { isNameless, nameOf, shortFirstName } from './names';
import type { Point } from './pins';
import { relativesOf } from './relatives';
import { simpleLayout } from './simpleLayout';

// The lowest row floats this far above the floor.
const LIFT = 2;
const NAME_SCALE = 50;
const LINE_COLOR = '#00e5ff';
const FOCUS_COLOR = '#ff4fd8';
const DOT_RADIUS = 0.18;
// A partnership symbol floats this far above its line.
const GLYPH_LIFT = 0.5;
const STYLES = {
  solid: {},
  dashed: { dashed: true, dashSize: 0.6, gapSize: 0.5 },
  dotted: { dashed: true, dashSize: 0.12, gapSize: 0.25 },
} as const;

const flat = ([x, y]: XY): Point => [x, y, 0];

// The experimental view's family tree: names floating on one row per generation, joined by lines drawn
// like a circuit diagram (`experimental/routing.ts`), at positions that follow from the relations alone.
// `facing` turns it toward the camera.
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
  const { positions, routes } = useMemo(() => {
    const model = buildModel(members);
    const positions = simpleLayout(members, model.gen);
    const at = new Map([...positions].map(([id, [x, y]]): [string, XY] => [id, [x, y]]));
    return { positions, routes: route(model, at) };
  }, [members]);
  // The focused person and the relatives the panel lists: a line stands out when it joins them.
  const focused = useMemo(() => {
    const focus = members.find((m) => m.id === focusId);
    if (!focus) return null;
    const r = relativesOf(focus, members);
    return { id: focus.id, relatives: new Set([...r.parents, ...r.children, ...r.partners, ...r.siblings, ...r.halfSiblings].map((m) => m.id)) };
  }, [members, focusId]);
  const stands = (people: string[]) => focused != null && people.includes(focused.id) && people.some((id) => focused.relatives.has(id));
  const lines = (style: Segment['style'], marked: boolean) =>
    routes.segments.filter((s) => s.style === style && stands(s.people) === marked).flatMap((s) => [flat(s.a), flat(s.b)]);
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <group position={[0, base + LIFT, 0]} rotation-y={Math.PI / 2 - facing}>
      {showLines &&
        (['solid', 'dashed', 'dotted'] as const).flatMap((style) =>
          [false, true].map((marked) => {
            const points = lines(style, marked);
            return (
              points.length > 0 && (
                <Line key={`${style}-${marked}`} points={points} segments color={marked ? FOCUS_COLOR : LINE_COLOR} lineWidth={marked ? 3 : 2} {...STYLES[style]} />
              )
            );
          }),
        )}
      {showLines &&
        routes.junctions.map((at) => (
          <mesh key={at.join()} position={flat(at)}>
            <circleGeometry args={[DOT_RADIUS, 12]} />
            <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
          </mesh>
        ))}
      {showLines &&
        routes.glyphs.map(({ at, glyph, people }) => (
          <Html key={people.join()} position={[at[0], at[1] + GLYPH_LIFT, 0]} center distanceFactor={NAME_SCALE}>
            <span className={`simple-glyph${stands(people) ? ' is-focus' : ''}`} aria-hidden>
              {glyph}
            </span>
          </Html>
        ))}
      {showLines &&
        routes.stubs.map(({ child, parents, at }) => (
          <Html key={`${child}-${parents.join()}`} position={flat(at)} center distanceFactor={NAME_SCALE}>
            <button className="simple-stub" type="button" onClick={() => onOpen(parents[0])}>
              {t.members.parentsOf(shortFirstName(byId.get(child)?.firstName ?? '') || t.members.unknown)}
            </button>
          </Html>
        ))}
      {members.map((member) => (
        // Labels scale with the distance like the rest of the scene, so the gaps between them hold.
        <Html key={member.id} position={positions.get(member.id)} center distanceFactor={NAME_SCALE}>
          <button className="simple-name" type="button" title={nameOf(member, t.members.unknown)} onClick={() => onOpen(member.id)}>
            {isNameless(member) ? (
              t.members.unknown
            ) : (
              <>
                {member.deathDate ? '† ' : ''}
                {shortFirstName(member.firstName)}
                <br />
                {member.lastName}
              </>
            )}
          </button>
        </Html>
      ))}
    </group>
  );
}
