'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { Member } from '../lib/api/generated/members';
import { bloodLinks, lineageLinks, linkKey } from './experimental/highlight';
import { buildModel } from './experimental/model';
import { route, type Segment, type XY } from './experimental/routing';
import { useT } from './i18n';
import PresenceDot from './live/PresenceDot';
import { initialsOf, isNameless, nameOf, shortFirstName } from './names';
import { lifeSpan } from './PersonPanel';
import type { Point } from './pins';
import type { SlotMount } from './RelativeSlots';
import { lineageOf } from './relatives';
import { simpleLayout } from './simpleLayout';
import { useTokenPaint } from './tokenColor';

// The lowest row floats this far above the floor.
const LIFT = 2;
// Labels keep their size relative to the tree at any window height: at NAME_SCALE_HEIGHT pixels a
// name is about NAME_W x NAME_H units, which the layout's gaps rely on.
const NAME_SCALE = 50;
const NAME_SCALE_HEIGHT = 768;
// Blood relatives (a developer option) keep a hue of their own, since the legend tells them apart
// from the lineage; every other line takes its colour from the tokens.
export const BLOOD_COLOR = '#ffb347';
// How a line stands out: on the selected person's lineage, for blood relatives, or not at all.
type Mark = 'focus' | 'blood' | undefined;
// Screen pixels: the thin lines, and the soft glow under the lit lineage.
const LINE_WIDTH = 1.3;
const GLOW_WIDTH = 5;
const DOT_RADIUS = 0.12;
// A partnership symbol floats this far above its line.
const GLYPH_LIFT = 0.5;
// The lines keep their token colour exactly: no tone mapping.
const STYLES = {
  solid: { toneMapped: false },
  dashed: { toneMapped: false, dashed: true, dashSize: 0.6, gapSize: 0.5 },
  dotted: { toneMapped: false, dashed: true, dashSize: 0.12, gapSize: 0.25 },
} as const;

// Half width and height of the hop where a partnership line bridges a crossing vertical.
const HOP_W = 0.3;
const HOP_H = 0.25;

const flat = ([x, y]: XY): Point => [x, y, 0];

// Draws each bridge as a hop: the horizontal line through it leaves a gap around the crossing and
// arcs over it in a few straight pieces.
function hop(segments: Segment[], bridges: XY[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    const [x0, x1] = [Math.min(seg.a[0], seg.b[0]), Math.max(seg.a[0], seg.b[0])];
    const y = seg.a[1];
    const xs = seg.a[1] === seg.b[1] ? bridges.filter(([bx, by]) => by === y && bx > x0 && bx < x1).map(([bx]) => bx).sort((p, q) => p - q) : [];
    if (!xs.length) {
      out.push(seg);
      continue;
    }
    let from = x0;
    for (const bx of xs) {
      out.push({ ...seg, a: [from, y], b: [bx - HOP_W, y] });
      const at = (i: number): XY => [bx - HOP_W * Math.cos((i / 8) * Math.PI), y + HOP_H * Math.sin((i / 8) * Math.PI)];
      for (let i = 0; i < 8; i++) out.push({ ...seg, a: at(i), b: at(i + 1) });
      from = bx + HOP_W;
    }
    out.push({ ...seg, a: [from, y], b: [x1, y] });
  }
  return out;
}

// The experimental (TRON) view's family tree: people as glass pills on one row per generation, joined
// by lines drawn like a circuit diagram (`experimental/routing.ts`) with sharp right angles, at positions
// that follow from the relations alone. `facing` turns it toward the camera.
export default function SimpleTree({
  members,
  base,
  facing,
  showLines,
  focusId,
  selectedId,
  bloodId,
  onOpen,
  slots,
}: {
  members: Member[];
  base: number;
  facing: number;
  showLines: boolean;
  // Whose lineage stands out (lines lit, everyone else dimmed), or null.
  focusId: string | null;
  // The person whose panel is open, whose pill glows.
  selectedId: string | null;
  // Whose lines to their blood relatives stand out, or null.
  bloodId: string | null;
  onOpen: (id: string) => void;
  // The "+" slots around the selected name, missing without the permission to add people.
  slots?: SlotMount;
}) {
  const t = useT();
  const scale = (NAME_SCALE * useThree((state) => state.size.height)) / NAME_SCALE_HEIGHT;
  const { positions, routes } = useMemo(() => {
    const model = buildModel(members);
    const positions = simpleLayout(members, model.gen);
    const at = new Map([...positions].map(([id, [x, y]]): [string, XY] => [id, [x, y]]));
    const routes = route(model, at);
    return { positions, routes: { ...routes, segments: hop(routes.segments, routes.bridges) } };
  }, [members]);
  // The pairs whose lines stand out (`experimental/highlight.ts`): the lineage over the blood
  // relatives where both apply.
  const marked = useMemo(() => {
    const of = (id: string | null, links: typeof lineageLinks) => {
      const focus = members.find((m) => m.id === id);
      return focus ? links(focus, members) : new Set<string>();
    };
    return { focus: of(focusId, lineageLinks), blood: of(bloodId, bloodLinks) };
  }, [members, focusId, bloodId]);
  const lineage = useMemo(() => {
    const focus = members.find((m) => m.id === focusId);
    return focus ? lineageOf(focus, members) : null;
  }, [members, focusId]);
  const paint = { none: useTokenPaint('--line-dim'), focus: useTokenPaint('--line-on'), blood: { color: BLOOD_COLOR, opacity: 1 } };
  const glow = useTokenPaint('--glow');
  const markOf = (links: Segment['links']) =>
    (['focus', 'blood'] as const).find((mark) => links.some(([x, y]) => marked[mark].has(linkKey(x, y))));
  const markClass = (links: Segment['links']) => {
    const mark = markOf(links);
    return mark ? ` is-${mark}` : '';
  };
  const lines = (style: Segment['style'], mark: Mark) =>
    routes.segments.filter((s) => s.style === style && markOf(s.links) === mark).flatMap((s) => [flat(s.a), flat(s.b)]);
  // A junction dot takes the strongest mark of the lines meeting there.
  const dotMark = ([x, y]: XY): Mark => {
    const meeting = routes.segments.filter((s) => [s.a, s.b].some(([px, py]) => Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6));
    const marks = meeting.map((s) => markOf(s.links));
    return marks.includes('focus') ? 'focus' : marks.includes('blood') ? 'blood' : undefined;
  };
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <group position={[0, base + LIFT, 0]} rotation-y={Math.PI / 2 - facing}>
      {showLines &&
        (['solid', 'dashed', 'dotted'] as const).flatMap((style) =>
          ([undefined, 'blood', 'focus'] as const).map((mark) => {
            const points = lines(style, mark);
            const { color, opacity } = paint[mark ?? 'none'];
            return (
              points.length > 0 && (
                <group key={`${style}-${mark}`}>
                  {mark === 'focus' && (
                    <Line points={points} segments color={glow.color} opacity={glow.opacity} transparent lineWidth={GLOW_WIDTH} {...STYLES[style]} />
                  )}
                  <Line points={points} segments color={color} opacity={opacity} transparent lineWidth={LINE_WIDTH} {...STYLES[style]} />
                </group>
              )
            );
          }),
        )}
      {showLines &&
        routes.junctions.map((at) => {
          const { color, opacity } = paint[dotMark(at) ?? 'none'];
          return (
            <mesh key={at.join()} position={flat(at)}>
              <circleGeometry args={[DOT_RADIUS, 12]} />
              <meshBasicMaterial color={color} opacity={opacity} transparent toneMapped={false} />
            </mesh>
          );
        })}
      {showLines &&
        routes.glyphs.map(({ at, glyph, people }) => (
          <Html key={people.join()} position={[at[0], at[1] + GLYPH_LIFT, 0]} center distanceFactor={scale}>
            <span className={`simple-glyph${markClass([people])}`} aria-hidden>
              {glyph}
            </span>
          </Html>
        ))}
      {showLines &&
        routes.stubs.map(({ child, parents, at }) => (
          <Html key={`${child}-${parents.join()}`} position={flat(at)} center distanceFactor={scale}>
            <button className={`simple-stub${markClass(parents.map((p) => [p, child]))}`} type="button" onClick={() => onOpen(parents[0])}>
              {t.members.parentsOf(shortFirstName(byId.get(child)?.firstName ?? '') || t.members.unknown)}
            </button>
          </Html>
        ))}
      {members.map((member) => {
        const state = member.id === selectedId ? ' is-selected' : !lineage ? '' : lineage.has(member.id) ? ' is-lineage' : ' is-dimmed';
        const years = lifeSpan(member);
        return (
          // Pills scale with the distance and the window height like the rest of the scene, so the gaps between them hold.
          <Html key={member.id} position={positions.get(member.id)} center distanceFactor={scale}>
            <button
              className={`simple-name${state}`}
              type="button"
              title={nameOf(member, t.members.unknown)}
              aria-label={t.profile.open(nameOf(member, t.members.unknown))}
              onClick={() => onOpen(member.id)}
            >
              <span className="simple-name-avatar" aria-hidden="true">
                {isNameless(member) ? '?' : initialsOf(member)}
              </span>
              <span className="simple-name-text">
                <span>{isNameless(member) ? t.members.unknown : shortFirstName(member.firstName) || member.lastName}</span>
                {years && <span className="simple-name-years">{years}</span>}
              </span>
              <PresenceDot memberId={member.id} />
            </button>
          </Html>
        );
      })}
      {slots && positions.has(slots.memberId) && slots.render(positions.get(slots.memberId)!, scale)}
    </group>
  );
}
