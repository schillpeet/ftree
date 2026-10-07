'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, Line, Sky } from '@react-three/drei';
import { Plane, Raycaster, SphereGeometry, Vector2, Vector3 } from 'three';
import type { Member, Placement } from '../lib/api/generated/members';
import { arrangePins } from './arrange';
import { relationLines } from './familyLayout';
import Meadow, { height } from './Meadow';
import { CARD, CARD_GAP, PIN_RADIUS, assignPins, cardTop, dropTarget, pickPins, type Drop, type Point } from './pins';
import Scroll, { CLICK_TOLERANCE } from './Scroll';
import Tree, { buildTree } from './Tree';

// Low sun in view, left behind the tree: warm side light and long shadows across the meadow.
const SUN: [number, number, number] = [-120, 16, -50];
// The sky's sun sits even lower (~1.5°) so the shader shows a real sunset glow; at that angle
// the light itself would graze the ground and leave it black.
const SKY_SUN: [number, number, number] = [-60, 0.8, -25];
const HAZE = '#b98a86';
const TREE_BASE = height(0, 0);
const CAMERA_START: [number, number, number] = [40, TREE_BASE + 15, 50];
const CAMERA_TARGET: [number, number, number] = [0, TREE_BASE + 9, 0];
const FOCUS_DISTANCE = 12;
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
    <div className="zoom-scale" role="group" aria-label="Zoom">
      <button type="button" aria-label="Hineinzoomen" onClick={() => zoomTo(zoom + ZOOM_STEP, true)}>+</button>
      <input
        type="range"
        aria-label="Zoomstufe"
        min={0}
        max={1}
        step={0.01}
        value={zoom}
        onChange={(event) => zoomTo(Number(event.target.value), false)}
      />
      <button type="button" aria-label="Herauszoomen" onClick={() => zoomTo(zoom - ZOOM_STEP, true)}>−</button>
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
    <div className="crown-scale" role="group" aria-label="Krone">
      <label>
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
        <span className="crown-scale-value">{previewScale.toFixed(2)}</span>
      </label>
    </div>
  );
}

// Development-only preview: moves related members onto nearby pins, from tight (−10) to spread
// (+10). Nothing is saved, so cards cannot be dragged while bundling is on.
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
    <div className="relation-spacing" role="group" aria-label="Beziehungsabstand">
      <label>
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
      <span className="relation-spacing-value">{spacing}</span>
    </div>
  );
}

function SunsetSky() {
  return (
    <>
      <Sky sunPosition={SKY_SUN} turbidity={10} rayleigh={3.5} mieCoefficient={0.004} mieDirectionalG={0.9} />
      {/* Exponential haze: the meadow fades gradually toward the horizon instead of ending in a band. */}
      <fogExp2 attach="fog" args={[HAZE, 0.0009]} />
      <hemisphereLight args={['#f0a888', '#3a2c3c', 1.4]} />
      <directionalLight
        position={SUN}
        color="#ffa870"
        intensity={5}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={300}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
    </>
  );
}

type Drag = { id: string; position: Point; target: Drop };

function Scrolls({
  members,
  focus,
  pins,
  showPins,
  spacing,
  controlsRef,
  onOpen,
  onPlace,
}: {
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
  const pinOf = useMemo(() => assignPins(members, pins.length), [members, pins.length]);
  const shownPins = useMemo(
    () => (spacing == null ? pinOf : arrangePins(members, pins, pinOf, (CARD.width + CARD_GAP) * 1.15 ** spacing)),
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
    const occupied = new Set([...pinOf].flatMap(([m, pin]) => (m !== id ? [pin] : [])));
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
      last = { id, position, target: dropTarget(rect, screenPins, occupied) };
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
  members,
  focus,
  onOpen,
  onPlace,
}: {
  members: Member[];
  focus: Focus;
  onOpen: (id: string) => void;
  onPlace: (id: string, placement: Placement) => void;
}) {
  const controlsRef = useRef<CameraControls>(null);
  const [controls, setControls] = useState<CameraControls | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [showPins, setShowPins] = useState(false);
  const [spacing, setSpacing] = useState(0);
  const [bundle, setBundle] = useState(false);
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
        <SunsetSky />
        <Meadow />
        <Tree tree={tree} position={[0, TREE_BASE, 0]} scale={previewScale} />
        <Scrolls
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
      <ZoomScale controls={controls} />
      <label className="pin-toggle">
        <input type="checkbox" checked={showPins} onChange={(event) => setShowPins(event.target.checked)} />
        Anheftpunkte
      </label>
      {process.env.NODE_ENV !== 'production' && (
        <CrownScale previewScale={previewScale} onPreviewScale={setPreviewScale} />
      )}
      {process.env.NODE_ENV !== 'production' && (
        <RelationSpacing spacing={spacing} bundle={bundle} onSpacing={setSpacing} onBundle={setBundle} />
      )}
    </>
  );
}
