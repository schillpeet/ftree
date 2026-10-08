'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Billboard, CameraControls, Line, Sky, Stars } from '@react-three/drei';
import { AdditiveBlending, CircleGeometry, Color, Plane, Raycaster, SphereGeometry, Vector2, Vector3, type Points } from 'three';
import type { Member, Placement } from '../lib/api/generated/members';
import { arrangePins, relationDistance } from './arrange';
import { relationLines } from './familyLayout';
import { generationBounds, layerPins } from './generations';
import Meadow, { height } from './Meadow';
import { CARD, CARD_GAP, PIN_RADIUS, assignPins, cardTop, dropTarget, pickPins, type Drop, type Point } from './pins';
import { haloTexture, moonTexture } from './moon';
import Scroll, { CLICK_TOLERANCE } from './Scroll';
import { daylight, fallbackLocation, highSun, starlight, sunDirection, sunPosition, type Location } from './sky';
import Tree, { buildTree } from './Tree';

// Sky colors (hemisphere sky, ground, haze) at night, with the sun low, and with the sun high.
const NIGHT = { sky: new Color('#4a5f96'), ground: new Color('#1c1a2c'), haze: new Color('#1a2238') };
const DUSK = { sky: new Color('#f0a888'), ground: new Color('#3a2c3c'), haze: new Color('#b98a86') };
const NOON = { sky: new Color('#d8e6f5'), ground: new Color('#3c3a30'), haze: new Color('#a9bccf') };
const SUN_LOW = new Color('#ffa870');
const SUN_HIGH = new Color('#fff2dc');
const MOONLIGHT = new Color('#9fb4ff');
// The light never comes in flatter than this: grazing light would leave the meadow black.
const MIN_LIGHT_ALTITUDE = (8 * Math.PI) / 180;
const LIGHT_DISTANCE = 120;
const TWILIGHT_GLOW = 0.3;
const SHADOW = {
  'shadow-camera-left': -60,
  'shadow-camera-right': 60,
  'shadow-camera-top': 60,
  'shadow-camera-bottom': -60,
  'shadow-camera-far': 300,
  'shadow-bias': -0.0005,
  'shadow-normalBias': 0.02,
};
const MOON_DISTANCE = 2500;
// The moon's arc is flattened to at most ~20° so it stays in view, which the camera never tilts up to.
const MOON_FLATTEN = 0.35;
// A full moon looks flat anyway: a disc facing the viewer, about four times its real size.
const MOON_GEOMETRY = new CircleGeometry(70, 64);
const HALO_GEOMETRY = new CircleGeometry(260, 32);
const STARS = 4000;
const TREE_BASE = height(0, 0);
const CAMERA_START: [number, number, number] = [40, TREE_BASE + 15, 50];
const CAMERA_TARGET: [number, number, number] = [0, TREE_BASE + 9, 0];
const FOCUS_DISTANCE = 12;
// A child's card hangs fully below its parents' cards.
const GENERATION_GAP = CARD.height + CARD_GAP;
// Relation lines run through the canopy; like the scrolls they are drawn over the leaves.
const ON_TOP = { depthTest: false, renderOrder: 1 };
const MIN_DISTANCE = 8;
const MAX_DISTANCE = 150;
// camera-controls divides trackpad deltas by 10, so the default speed needs a lot of pinching.
const DOLLY_SPEED = 5;
const ZOOM_STEP = 0.1;
// Unplaced cards wait in rows on this arc in front of the tree, facing the start camera.
const WAITING_RADIUS = 30;
const WAITING_PER_ROW = 12;
const VIEW_FRONT = Math.atan2(CAMERA_START[2], CAMERA_START[0]);
// South lies straight ahead from the start view, so the sun's whole daily arc crosses in front.
const SOUTH = VIEW_FRONT + Math.PI;
const MINUTES_PER_DAY = 24 * 60;
const PIN_GEOMETRY = new SphereGeometry(PIN_RADIUS, 12, 8);

export type Focus = { id: string } | null;

// ponytail: cards left over when the free pins run out are not persisted here until dragged; the
// rows simply grow upward when there are many.
function waitingPosition(index: number): Point {
  const column = index % WAITING_PER_ROW;
  const row = Math.floor(index / WAITING_PER_ROW);
  const angle = VIEW_FRONT + ((column - (WAITING_PER_ROW - 1) / 2) * (CARD.width + CARD_GAP)) / WAITING_RADIUS;
  const [x, z] = [Math.cos(angle) * WAITING_RADIUS, Math.sin(angle) * WAITING_RADIUS];
  return [x, height(x, z) + CARD.height + 0.5 + row * (CARD.height + CARD_GAP), z];
}

// The scale is logarithmic in distance, so each step feels the same near and far.
const toZoom = (distance: number) => Math.log(MAX_DISTANCE / distance) / Math.log(MAX_DISTANCE / MIN_DISTANCE);
const toDistance = (zoom: number) => MAX_DISTANCE * (MIN_DISTANCE / MAX_DISTANCE) ** zoom;

// Lives outside the canvas and owns its own state, so syncing it on every camera frame
// doesn't re-render the scene.
function ZoomScale({ controls }: { controls: CameraControls | null }) {
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    if (!controls) return;
    const sync = () => setZoom(toZoom(controls.distance));
    sync();
    controls.addEventListener('update', sync);
    return () => controls.removeEventListener('update', sync);
  }, [controls]);

  const zoomTo = (value: number, smooth: boolean) =>
    void controls?.dollyTo(toDistance(Math.min(1, Math.max(0, value))), smooth);

  return (
    <div className="debug-row" role="group" aria-label="Zoom">
      <span>Zoom</span>
      <input
        type="range"
        aria-label="Zoomstufe"
        min={0}
        max={1}
        step={0.01}
        value={zoom}
        onChange={(event) => zoomTo(Number(event.target.value), false)}
      />
      <span className="zoom-steps">
        <button type="button" aria-label="Herauszoomen" onClick={() => zoomTo(zoom - ZOOM_STEP, true)}>−</button>
        <button type="button" aria-label="Hineinzoomen" onClick={() => zoomTo(zoom + ZOOM_STEP, true)}>+</button>
      </span>
    </div>
  );
}

// Development-only calibration slider: scales the crown and its pins live, while the cards keep
// their fixed world size.
function CrownScale({
  previewScale,
  onPreviewScale,
}: {
  previewScale: number;
  onPreviewScale: (value: number) => void;
}) {
  return (
    <label className="debug-row">
      <span>Krone</span>
      <input
        type="range"
        aria-label="Kronengröße"
        min={0.3}
        max={2}
        step={0.01}
        value={previewScale}
        onChange={(event) => onPreviewScale(Number(event.target.value))}
      />
      <span className="debug-row-value">{previewScale.toFixed(2)}</span>
    </label>
  );
}

// Development-only preview: moves related members onto nearby pins, from as close as cards fit
// (−10) over twice that (0) to as far apart as the pins allow (+10). Nothing is saved, so cards
// cannot be dragged while bundling is on.
function RelationSpacing({
  spacing,
  bundle,
  onSpacing,
  onBundle,
}: {
  spacing: number;
  bundle: boolean;
  onSpacing: (value: number) => void;
  onBundle: (value: boolean) => void;
}) {
  return (
    <div className="debug-row" role="group" aria-label="Beziehungsabstand">
      <label className="debug-check">
        <input type="checkbox" checked={bundle} onChange={(event) => onBundle(event.target.checked)} />
        Bündeln
      </label>
      <input
        type="range"
        aria-label="Beziehungsabstand"
        min={-10}
        max={10}
        step={1}
        value={spacing}
        onChange={(event) => onSpacing(Number(event.target.value))}
      />
      <span className="debug-row-value">{spacing}</span>
    </div>
  );
}

// Moves in steps of five minutes, a full turn per day with midnight at the top.
function DebugClock({ minutes, onMinutes }: { minutes: number; onMinutes: (value: number) => void }) {
  const angle = (minutes / MINUTES_PER_DAY) * Math.PI * 2;
  const set = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const turn = Math.atan2(event.clientX - box.left - box.width / 2, -(event.clientY - box.top - box.height / 2));
    onMinutes((Math.round(((turn / (Math.PI * 2)) * MINUTES_PER_DAY) / 5) * 5 + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  };
  return (
    <div className="debug-clock">
      <svg
        viewBox="-50 -50 100 100"
        role="slider"
        aria-label="Uhrzeit"
        aria-valuemin={0}
        aria-valuemax={MINUTES_PER_DAY - 5}
        aria-valuenow={minutes}
        aria-valuetext={formatTime(minutes)}
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          set(event);
        }}
        onPointerMove={(event) => event.buttons && set(event)}
        onKeyDown={(event) => {
          const step = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15 }[event.key];
          if (!step) return;
          event.preventDefault();
          onMinutes((minutes + step + MINUTES_PER_DAY) % MINUTES_PER_DAY);
        }}
      >
        <circle r={46} className="debug-clock-face" />
        {Array.from({ length: 24 }, (_, hour) => {
          const a = (hour / 24) * Math.PI * 2;
          const inner = hour % 6 === 0 ? 34 : 40;
          return <line key={hour} x1={Math.sin(a) * inner} y1={-Math.cos(a) * inner} x2={Math.sin(a) * 44} y2={-Math.cos(a) * 44} className="debug-clock-tick" />;
        })}
        {[0, 6, 12, 18].map((hour) => {
          const a = (hour / 24) * Math.PI * 2;
          return (
            <text key={hour} x={Math.sin(a) * 24} y={-Math.cos(a) * 24} className="debug-clock-label">
              {hour}
            </text>
          );
        })}
        <line x2={Math.sin(angle) * 38} y2={-Math.cos(angle) * 38} className="debug-clock-hand" />
        <circle r={3} className="debug-clock-pivot" />
      </svg>
      <span className="debug-row-value">{formatTime(minutes)}</span>
    </div>
  );
}

const formatTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Sun, moon, stars, and light for the given moment at the browser's location. The moon simply
// stands opposite the sun, lower, and is always full.
function DaySky({ date, location }: { date: Date; location: Location }) {
  const stars = useRef<Points>(null);
  const [moonMap] = useState(moonTexture);
  const [haloMap] = useState(haloTexture);
  const { altitude, azimuth } = sunPosition(date, location);
  // The sky shader's own sunlight ends ~2° below the horizon; raising its sun during twilight
  // keeps the afterglow (and dawn) through civil twilight instead of minutes.
  const sun = sunDirection(altitude < 0 ? altitude * TWILIGHT_GLOW : altitude, azimuth, SOUTH);
  const day = daylight(altitude);
  const high = highSun(altitude);
  const mix = (key: keyof typeof NIGHT) => NIGHT[key].clone().lerp(DUSK[key], day).lerp(NOON[key], high);
  // Sun and moon light cross-fade through twilight, never from flatter than MIN_LIGHT_ALTITUDE.
  const lightFrom = (alt: number, az: number) =>
    sunDirection(Math.max(MIN_LIGHT_ALTITUDE, alt), az, SOUTH).map((v) => v * LIGHT_DISTANCE) as [number, number, number];
  const moon = sunDirection(Math.asin(MOON_FLATTEN * Math.sin(-altitude)), azimuth + Math.PI, SOUTH);
  const starCount = Math.round(STARS * starlight(altitude));

  useLayoutEffect(() => stars.current?.geometry.setDrawRange(0, starCount), [starCount]);

  return (
    <>
      <Sky sunPosition={sun} turbidity={10} rayleigh={3.5} mieCoefficient={0.004} mieDirectionalG={0.9} />
      <Stars ref={stars} radius={3000} depth={500} count={STARS} factor={110} speed={0} fade />
      {altitude < 0.1 && (
        <Billboard position={moon.map((v) => v * MOON_DISTANCE) as [number, number, number]}>
          <mesh geometry={HALO_GEOMETRY} position-z={-5}>
            <meshBasicMaterial map={haloMap} transparent blending={AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
          </mesh>
          <mesh geometry={MOON_GEOMETRY}>
            <meshBasicMaterial map={moonMap} transparent depthWrite={false} fog={false} toneMapped={false} />
          </mesh>
        </Billboard>
      )}
      {/* Exponential haze: the meadow fades gradually toward the horizon instead of ending in a band. */}
      <fogExp2 attach="fog" args={[DUSK.haze, 0.0009]} color={mix('haze')} />
      <hemisphereLight color={mix('sky')} groundColor={mix('ground')} intensity={0.8 + 0.6 * day} />
      <directionalLight
        position={lightFrom(altitude, azimuth)}
        color={SUN_LOW.clone().lerp(SUN_HIGH, high)}
        intensity={5 * day}
        castShadow
        shadow-mapSize={[4096, 4096]}
        {...SHADOW}
      />
      <directionalLight
        position={lightFrom(-altitude, azimuth + Math.PI)}
        color={MOONLIGHT}
        intensity={1.5 * (1 - day)}
        castShadow
        shadow-mapSize={[1024, 1024]}
        {...SHADOW}
      />
    </>
  );
}

type Drag = { id: string; position: Point; target: Drop };

function Scrolls({
  familyId,
  members,
  focus,
  pins,
  showPins,
  spacing,
  controlsRef,
  onOpen,
  onPlace,
}: {
  familyId: string | null;
  members: Member[];
  focus: Focus;
  pins: Point[];
  showPins: boolean;
  // Relation spacing while bundling, otherwise null.
  spacing: number | null;
  controlsRef: RefObject<CameraControls | null>;
  onOpen: (id: string) => void;
  onPlace: (id: string, placement: Placement) => void;
}) {
  const { camera, events, gl } = useThree();
  const [drag, setDrag] = useState<Drag | null>(null);
  const pinOf = useMemo(() => layerPins(members, pins, assignPins(members, pins.length), GENERATION_GAP), [members, pins]);
  const shownPins = useMemo(
    () =>
      spacing == null
        ? pinOf
        : layerPins(
            members,
            pins,
            arrangePins(members, pins, pinOf, relationDistance(spacing, pins, CARD.width + CARD_GAP)),
            GENERATION_GAP,
          ),
    [members, pins, pinOf, spacing],
  );
  const placed = useMemo(() => {
    const positions = new Map<string, Point>();
    let waiting = 0;
    for (const m of members) {
      const pin = shownPins.get(m.id);
      positions.set(
        m.id,
        pin != null ? cardTop(pins[pin]) : m.position ? [m.position.x, TREE_BASE + m.position.y, m.position.z] : waitingPosition(waiting++),
      );
    }
    return positions;
  }, [members, pins, shownPins]);
  const positions = useMemo(
    () => (drag ? new Map(placed).set(drag.id, drag.position) : placed),
    [placed, drag],
  );

  const links = useMemo(() => relationLines(members, positions), [members, positions]);

  useEffect(() => {
    const target = focus && placed.get(focus.id);
    const controls = controlsRef.current;
    if (!target || !controls) return;
    const [x, y, z] = target;
    // Keep the current viewing direction, just move close to the scroll.
    const eye = camera.position.clone().sub(controls.getTarget(new Vector3())).setLength(FOCUS_DISTANCE).add(new Vector3(x, y, z));
    void controls.setLookAt(eye.x, eye.y, eye.z, x, y, z, true);
    // Only a new focus request should move the camera, not later member changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // The card follows the pointer on a plane facing the camera through its start position. The
  // drop target is decided on screen, where the user sees the card touch a pin.
  function startDrag(id: string, event: PointerEvent<HTMLDivElement>) {
    const card = event.currentTarget;
    const canvas = gl.domElement.getBoundingClientRect();
    const toScreen = (p: Point) => {
      const v = new Vector3(...p).project(camera);
      return { x: canvas.left + ((v.x + 1) / 2) * canvas.width, y: canvas.top + ((1 - v.y) / 2) * canvas.height, z: v.z };
    };
    const raycaster = new Raycaster();
    const start = new Vector3(...placed.get(id)!);
    const plane = new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), start);
    const hit = (x: number, y: number) => {
      raycaster.setFromCamera(new Vector2(((x - canvas.left) / canvas.width) * 2 - 1, -((y - canvas.top) / canvas.height) * 2 + 1), camera);
      return raycaster.ray.intersectPlane(plane, new Vector3());
    };
    const grab = start.clone().sub(hit(event.clientX, event.clientY) ?? start);
    // Pins that would put the card less than a card below a parent or above a child count as
    // occupied, and so does such a free spot: the card springs back.
    const settled = new Map(members.flatMap((m) => (pinOf.has(m.id) || m.position ? [[m.id, placed.get(m.id)!] as const] : [])));
    const { lowest, highest } = generationBounds(id, members, settled, GENERATION_GAP);
    const fits = (y: number) => y >= lowest && y <= highest;
    const occupied = new Set([
      ...[...pinOf].flatMap(([m, pin]) => (m !== id ? [pin] : [])),
      ...pins.flatMap((pin, i) => (fits(cardTop(pin)[1]) ? [] : [i])),
    ]);
    // Pins behind the camera project to z > 1 and cannot be touched.
    const radius = new Vector3(0, PIN_RADIUS, 0).applyQuaternion(camera.quaternion);
    const screenPins = pins
      .map(([x, y, z], pinId) => {
        const centre = toScreen([x, y, z]);
        const edge = toScreen([x + radius.x, y + radius.y, z + radius.z]);
        return { id: pinId, ...centre, r: Math.hypot(edge.x - centre.x, edge.y - centre.y) };
      })
      .filter((p) => p.z < 1);
    const { width, height: cardHeight } = card.getBoundingClientRect();
    const [x0, y0] = [event.clientX, event.clientY];
    let last: Drag | null = null;

    const move = (e: globalThis.PointerEvent) => {
      if (!last && Math.hypot(e.clientX - x0, e.clientY - y0) <= CLICK_TOLERANCE) return;
      const point = hit(e.clientX, e.clientY);
      if (!point) return;
      const position = point.add(grab).toArray();
      const c = toScreen(position);
      const rect = { left: c.x - width / 2, right: c.x + width / 2, top: c.y, bottom: c.y + cardHeight };
      const target = dropTarget(rect, screenPins, occupied);
      last = { id, position, target: target === 'free' && !fits(position[1]) ? 'reject' : target };
      setDrag(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      // No movement: a click, which Scroll turns into opening the profile.
      if (!last || last.target === 'reject') return;
      const [x, y, z] = last.position;
      onPlace(id, last.target === 'free' ? { pinId: null, position: { x, y: y - TREE_BASE, z } } : { pinId: last.target.pin, position: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  const highlighted = drag && typeof drag.target === 'object' ? drag.target.pin : null;

  // drei's Html loses its content if its target changes after mount, so wait until the
  // canvas has connected its event source (the element Html attaches to).
  if (!events.connected) return null;
  return (
    <>
      {members.map((member) => (
        <Scroll
          key={member.id}
          member={member}
          familyId={familyId}
          position={positions.get(member.id)!}
          onOpen={() => onOpen(member.id)}
          onDrag={showPins && spacing == null ? (event) => startDrag(member.id, event) : undefined}
        />
      ))}
      {showPins &&
        pins.map((pin, i) => (
          <mesh key={i} position={pin} geometry={PIN_GEOMETRY} scale={i === highlighted ? 2 : 1} renderOrder={1}>
            <meshBasicMaterial color={i === highlighted ? '#ffd23f' : '#d42020'} depthTest={false} />
          </mesh>
        ))}
      {links.parents.length > 0 && <Line points={links.parents} segments color="#f5e6c4" lineWidth={3} {...ON_TOP} />}
      {links.partners.length > 0 && <Line points={links.partners} segments color="#e8b54a" lineWidth={4} {...ON_TOP} />}
    </>
  );
}

export default function Scene({
  familyId,
  members,
  focus,
  onOpen,
  onPlace,
  debugTools,
}: {
  familyId: string | null;
  members: Member[];
  focus: Focus;
  onOpen: (id: string) => void;
  onPlace: (id: string, placement: Placement) => void;
  debugTools?: ReactNode;
}) {
  const controlsRef = useRef<CameraControls>(null);
  const [controls, setControls] = useState<CameraControls | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [showPins, setShowPins] = useState(false);
  const [spacing, setSpacing] = useState(0);
  const [bundle, setBundle] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [location, setLocation] = useState(fallbackLocation);
  // Minutes after midnight shown by the debug clock, or null for the real time.
  const [clock, setClock] = useState<number | null>(null);
  const tree = useMemo(() => buildTree(7), []);
  // Pins follow the crown scale; only points with room for a card above the ground qualify.
  const pins = useMemo(
    () =>
      pickPins(
        tree.pinCandidates
          .map(([x, y, z]): Point => [x * previewScale, TREE_BASE + y * previewScale, z * previewScale])
          .filter(([x, y, z]) => y - PIN_RADIUS - CARD.height > height(x, z)),
      ),
    [tree, previewScale],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    // The location never leaves the browser; without permission the time zone has to do.
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setLocation({ latitude: coords.latitude, longitude: coords.longitude }),
      () => {},
      { maximumAge: 24 * 60 * 60 * 1000 },
    );
    return () => clearInterval(timer);
  }, []);
  const date = useMemo(
    () => (clock == null ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, clock)),
    [now, clock],
  );
  // Stable callback, so the start view is only applied once when the controls mount.
  const initControls = useCallback((controls: CameraControls | null) => {
    controlsRef.current = controls;
    setControls(controls);
    void controls?.setLookAt(...CAMERA_START, ...CAMERA_TARGET, false);
  }, []);

  return (
    <>
      <Canvas
        shadows="percentage"
        // Lower exposure keeps the bright sky shader from washing out to white; lights compensate.
        gl={{ toneMappingExposure: 0.6 }}
        camera={{ position: CAMERA_START, fov: 50, far: 10000 }}
        style={{ position: 'fixed', inset: 0 }}
      >
        <DaySky date={date} location={location} />
        <Meadow />
        <Tree tree={tree} position={[0, TREE_BASE, 0]} scale={previewScale} />
        <Scrolls
          familyId={familyId}
          members={members}
          focus={focus}
          pins={pins}
          showPins={showPins}
          spacing={bundle ? spacing : null}
          controlsRef={controlsRef}
          onOpen={onOpen}
          onPlace={onPlace}
        />
        <CameraControls
          ref={initControls}
          makeDefault
          maxPolarAngle={Math.PI / 2.1}
          minDistance={MIN_DISTANCE}
          maxDistance={MAX_DISTANCE}
          dollySpeed={DOLLY_SPEED}
        />
      </Canvas>
      <details className="debug-panel">
        <summary>Debug</summary>
        <div className="debug-panel-body">
          <section>
            <h2>Daten</h2>
            {debugTools}
          </section>
          <section>
            <h2>Ansicht</h2>
            <ZoomScale controls={controls} />
            <label className="debug-check pin-toggle">
              <input type="checkbox" checked={showPins} onChange={(event) => setShowPins(event.target.checked)} />
              Anheftpunkte
            </label>
            <label className="debug-check">
              <input
                type="checkbox"
                checked={clock != null}
                onChange={(event) =>
                  setClock(event.target.checked ? Math.round((now.getHours() * 60 + now.getMinutes()) / 5) * 5 % MINUTES_PER_DAY : null)
                }
              />
              Uhr
            </label>
            {clock != null && <DebugClock minutes={clock} onMinutes={setClock} />}
          </section>
          {process.env.NODE_ENV !== 'production' && (
            <section>
              <h2>Vorschau</h2>
              <CrownScale previewScale={previewScale} onPreviewScale={setPreviewScale} />
              <RelationSpacing spacing={spacing} bundle={bundle} onSpacing={setSpacing} onBundle={setBundle} />
            </section>
          )}
        </div>
      </details>
    </>
  );
}
