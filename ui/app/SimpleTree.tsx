'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
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
// Labels keep their size relative to the tree at any window height: at NAME_SCALE_HEIGHT pixels a
// name is about NAME_W x NAME_H units, which the layout's gaps rely on.
const NAME_SCALE = 50;
const NAME_SCALE_HEIGHT = 768;
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

// Corner radius where a bar turns into a riser or stem.
const CORNER = 0.12;

const flat = ([x, y]: XY): Point => [x, y, 0];

// Rounds the corners of the routed lines: where exactly two segments end at a right angle and no
// junction is, both are shortened and joined by a short curve. Junctions stay sharp.
function soften(segments: Segment[], junctions: XY[]): Segment[] {
  const key = ([x, y]: XY) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
  const dots = new Set(junctions.map(key));
  const ends = new Map<string, { s: number; end: 'a' | 'b' }[]>();
  for (const [s, seg] of segments.entries())
    for (const end of ['a', 'b'] as const) ends.set(key(seg[end]), [...(ends.get(key(seg[end])) ?? []), { s, end }]);
  const out = segments.map((s) => ({ ...s, a: [...s.a] as XY, b: [...s.b] as XY }));
  const curves: Segment[] = [];
  for (const [k, here] of ends) {
    if (here.length !== 2 || dots.has(k)) continue;
    const [p, q] = here.map(({ s, end }) => ({ seg: out[s], end }));
    const dir = ({ seg, end }: typeof p): XY => {
      const [from, to] = end === 'a' ? [seg.a, seg.b] : [seg.b, seg.a];
      return [to[0] - from[0], to[1] - from[1]];
    };
    const [u, v] = [dir(p), dir(q)];
    // Only right angles: one horizontal, one vertical.
    if ((u[0] === 0) === (v[0] === 0)) continue;
    const corner = p.seg[p.end];
    const r = Math.min(CORNER, Math.hypot(...u) / 2, Math.hypot(...v) / 2);
    const step = ([dx, dy]: XY): XY => [corner[0] + (dx / Math.hypot(dx, dy)) * r, corner[1] + (dy / Math.hypot(dx, dy)) * r];
    const [from, to] = [step(u), step(v)];
    p.seg[p.end] = from;
    q.seg[q.end] = to;
    // A quadratic curve with the corner as control point, in a few straight pieces.
    const at = (t: number): XY => [0, 1].map((i) => (1 - t) ** 2 * from[i] + 2 * (1 - t) * t * corner[i] + t ** 2 * to[i]) as XY;
    // Each half of the curve belongs to the segment it continues, so focus marks it the same way.
    for (let i = 0; i < 6; i++) curves.push({ a: at(i / 6), b: at((i + 1) / 6), style: (i < 3 ? p : q).seg.style, people: (i < 3 ? p : q).seg.people });
  }
  return [...out, ...curves];
}

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
  const scale = (NAME_SCALE * useThree((state) => state.size.height)) / NAME_SCALE_HEIGHT;
  const { positions, routes } = useMemo(() => {
    const model = buildModel(members);
    const positions = simpleLayout(members, model.gen);
    const at = new Map([...positions].map(([id, [x, y]]): [string, XY] => [id, [x, y]]));
    const routes = route(model, at);
    return { positions, routes: { ...routes, segments: soften(routes.segments, routes.junctions) } };
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
          <Html key={people.join()} position={[at[0], at[1] + GLYPH_LIFT, 0]} center distanceFactor={scale}>
            <span className={`simple-glyph${stands(people) ? ' is-focus' : ''}`} aria-hidden>
              {glyph}
            </span>
          </Html>
        ))}
      {showLines &&
        routes.stubs.map(({ child, parents, at }) => (
          <Html key={`${child}-${parents.join()}`} position={flat(at)} center distanceFactor={scale}>
            <button className="simple-stub" type="button" onClick={() => onOpen(parents[0])}>
              {t.members.parentsOf(shortFirstName(byId.get(child)?.firstName ?? '') || t.members.unknown)}
            </button>
          </Html>
        ))}
      {members.map((member) => (
        // Labels scale with the distance and the window height like the rest of the scene, so the gaps between them hold.
        <Html key={member.id} position={positions.get(member.id)} center distanceFactor={scale}>
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
