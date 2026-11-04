'use client';

import { useMemo, useRef, type ComponentRef } from 'react';
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Member } from '../lib/api/generated/members';
import { bloodLinks, lineageLinks, linkKey } from './experimental/highlight';
import { buildModel } from './experimental/model';
import { route, type Segment, type XY } from './experimental/routing';
import { useT } from './i18n';
import PresenceDot from './live/PresenceDot';
import { useMotion, useReducedMotion } from './motion';
import { displayName, initialsOf, isNameless, lifeSpan, shortFirstName } from './names';
import { useCardDensity } from './cardDensity';
import { formatDate } from './MembersControls';
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
// Screen pixels, drawn bottom to top: a dark shadow under every line so it stands out on the blue horizon, the glow under
// the lit lineage, the line, and the lineage's white core.
const SHADOW_WIDTH = 7;
const GLOW_WIDTH = 8;
const LINE_WIDTH = 2;
const FOCUS_WIDTH = 2.4;
const CORE_WIDTH = 1.2;
// A junction is a solder pad: a dark dot in a ring of the line's colour.
const PAD_RADIUS = 0.22;
// The light pulse running down the lit lineage while the animations play: a short dash per gap, in units per second.
const PULSE = { width: 5, dashSize: 1.2, gapSize: 9, speed: 3 };
// A partnership symbol floats this far above its line.
const GLYPH_LIFT = 0.5;
// The lines keep their token colour exactly: no tone mapping. They lie in one plane with their shadow, which hides the floor
// grid behind them by depth, so everything above the shadow skips the depth test and stacks by `renderOrder` alone.
const FLAT = { toneMapped: false, depthTest: false } as const;
const STYLES = {
  solid: FLAT,
  dashed: { ...FLAT, dashed: true, dashSize: 0.6, gapSize: 0.5 },
  dotted: { ...FLAT, dashed: true, dashSize: 0.12, gapSize: 0.25 },
} as const;

// Half width and height of the hop where a partnership line bridges a crossing vertical.
const HOP_W = 0.3;
const HOP_H = 0.25;

const flat = ([x, y]: XY): Point => [x, y, 0];

// Every line piece runs from its parent's side to its child's, so a dash moving forward runs from the ancestors down.
function Pulse({ points, color }: { points: Point[]; color: string }) {
  const line = useRef<ComponentRef<typeof Line>>(null);
  useFrame((_, delta) => {
    if (line.current) line.current.material.dashOffset -= delta * PULSE.speed;
  });
  return (
    <Line
      ref={line}
      points={points}
      segments
      color={color}
      lineWidth={PULSE.width}
      {...FLAT}
      dashed
      dashSize={PULSE.dashSize}
      gapSize={PULSE.gapSize}
      renderOrder={4}
    />
  );
}

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
  selfId = null,
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
  // The signed-in user's own member, marked with a ring and a badge, or null.
  selfId?: string | null;
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
  const shadow = useTokenPaint('--line-shadow');
  const core = useTokenPaint('--line-core');
  const [motion] = useMotion();
  const [density] = useCardDensity();
  const reduced = useReducedMotion();
  const pulse = motion && !reduced;
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
      {showLines && (
        <Line
          points={routes.segments.flatMap((s) => [flat(s.a), flat(s.b)])}
          segments
          color={shadow.color}
          opacity={shadow.opacity}
          transparent
          lineWidth={SHADOW_WIDTH}
          renderOrder={0}
          toneMapped={false}
        />
      )}
      {showLines &&
        (['solid', 'dashed', 'dotted'] as const).flatMap((style) =>
          ([undefined, 'blood', 'focus'] as const).map((mark) => {
            const points = lines(style, mark);
            const { color, opacity } = paint[mark ?? 'none'];
            return (
              points.length > 0 && (
                <group key={`${style}-${mark}`}>
                  {mark === 'focus' && (
                    <Line
                      points={points}
                      segments
                      color={glow.color}
                      opacity={glow.opacity}
                      transparent
                      lineWidth={GLOW_WIDTH}
                      renderOrder={1}
                      {...STYLES[style]}
                    />
                  )}
                  <Line
                    points={points}
                    segments
                    color={color}
                    opacity={opacity}
                    transparent
                    lineWidth={mark === 'focus' ? FOCUS_WIDTH : LINE_WIDTH}
                    renderOrder={2}
                    {...STYLES[style]}
                  />
                  {mark === 'focus' && (
                    <Line
                      points={points}
                      segments
                      color={core.color}
                      opacity={core.opacity}
                      transparent
                      lineWidth={CORE_WIDTH}
                      renderOrder={3}
                      {...STYLES[style]}
                    />
                  )}
                  {mark === 'focus' && pulse && <Pulse points={points} color={core.color} />}
                </group>
              )
            );
          }),
        )}
      {showLines &&
        routes.junctions.map((at) => {
          const { color, opacity } = paint[dotMark(at) ?? 'none'];
          return (
            <group key={at.join()} position={flat(at)}>
              <mesh renderOrder={5}>
                <circleGeometry args={[PAD_RADIUS, 16]} />
                <meshBasicMaterial color={shadow.color} {...FLAT} />
              </mesh>
              <mesh renderOrder={6}>
                <ringGeometry args={[PAD_RADIUS * 0.5, PAD_RADIUS, 16]} />
                <meshBasicMaterial color={color} opacity={opacity} transparent {...FLAT} />
              </mesh>
            </group>
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
        const placeholder = isNameless(member);
        const name = displayName(member, members, t.placeholder.role);
        // Fuller pills (`cardDensity.ts`) keep their size: full name, birth name, and the date of birth while the
        // person lives (both dates would not fit, so the dead keep their years; the title has the dates).
        const full = density === 'm' && !placeholder;
        const nee = full && member.birthName && member.birthName !== member.lastName ? t.members.nee(member.birthName) : null;
        const dates = [formatDate(member.birthDate) && `* ${formatDate(member.birthDate)}`, formatDate(member.deathDate) && `† ${formatDate(member.deathDate)}`]
          .filter(Boolean)
          .join(' ');
        const when = full && member.birthDate && !member.deathDate ? `* ${formatDate(member.birthDate)}` : years;
        return (
          // Pills scale with the distance and the window height like the rest of the scene, so the gaps between them hold.
          <Html key={member.id} position={positions.get(member.id)} center distanceFactor={scale}>
            <button
              className={`simple-name${state}${placeholder ? ' is-placeholder' : ''}${full ? ' is-full' : ''}`}
                data-self={member.id === selfId || undefined}
              type="button"
              title={full && dates ? `${name} · ${dates}` : name}
              aria-label={t.profile.open(name)}
              onClick={() => onOpen(member.id)}
            >
              <span className="simple-name-avatar" aria-hidden="true">
                {placeholder ? '?' : initialsOf(member)}
              </span>
              <span className="simple-name-text">
                <span>
                  {placeholder
                    ? name
                    : full
                      ? [shortFirstName(member.firstName), member.lastName].filter(Boolean).join(' ')
                      : shortFirstName(member.firstName) || member.lastName}
                </span>
                {nee && <span className="simple-name-years">{nee}</span>}
                {when && <span className="simple-name-years">{when}</span>}
              </span>
              {member.id === selfId && <span className="self-badge">{t.tour.you}</span>}
              <PresenceDot memberId={member.id} />
            </button>
          </Html>
        );
      })}
      {slots && positions.has(slots.memberId) && slots.render(positions.get(slots.memberId)!, scale)}
    </group>
  );
}
