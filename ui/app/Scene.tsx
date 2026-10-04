'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, Line, Sky } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Member } from '../lib/api/generated/members';
import { layoutScrollsInSpace, relationLines } from './familyLayout';
import Meadow, { height } from './Meadow';
import Scroll from './Scroll';
import Tree from './Tree';
import {
  BASE_TREE_BOUNDS,
  CARD_WORLD_SIZE,
  SLOT_MARGINS,
  crownSpaceForScale,
  type LayoutSpace,
} from './treeGrowth';

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

export type Focus = { id: string } | null;

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

// Development-only calibration slider: scales the crown and the layout live, while the cards
// keep their fixed world size.
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

function Scrolls({
  members,
  focus,
  space,
  controlsRef,
  onOpen,
}: {
  members: Member[];
  focus: Focus;
  space: LayoutSpace;
  controlsRef: RefObject<CameraControls | null>;
  onOpen: (id: string) => void;
}) {
  const { camera, events } = useThree();
  const positions = useMemo(() => {
    const layout = layoutScrollsInSpace(members, space);
    layout.forEach((p) => (p[1] += TREE_BASE));
    return layout;
  }, [members, space]);

  const links = useMemo(() => relationLines(members, positions), [members, positions]);

  useEffect(() => {
    const target = focus && positions.get(focus.id);
    const controls = controlsRef.current;
    if (!target || !controls) return;
    const [x, y, z] = target;
    // Keep the current viewing direction, just move close to the scroll.
    const eye = camera.position.clone().sub(controls.getTarget(new Vector3())).setLength(FOCUS_DISTANCE).add(new Vector3(x, y, z));
    void controls.setLookAt(eye.x, eye.y, eye.z, x, y, z, true);
    // Only a new focus request should move the camera, not later member changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // drei's Html loses its content if its target changes after mount, so wait until the
  // canvas has connected its event source (the element Html attaches to).
  if (!events.connected) return null;
  return (
    <>
      {members.map((member) => (
        <Scroll key={member.id} member={member} position={positions.get(member.id)!} onOpen={() => onOpen(member.id)} />
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
}: {
  members: Member[];
  focus: Focus;
  onOpen: (id: string) => void;
}) {
  const controlsRef = useRef<CameraControls>(null);
  const [controls, setControls] = useState<CameraControls | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const space = useMemo(
    () => crownSpaceForScale(previewScale, BASE_TREE_BOUNDS, CARD_WORLD_SIZE, SLOT_MARGINS),
    [previewScale],
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
        <Tree position={[0, TREE_BASE, 0]} scale={previewScale} />
        <Scrolls members={members} focus={focus} space={space} controlsRef={controlsRef} onOpen={onOpen} />
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
      {process.env.NODE_ENV !== 'production' && (
        <CrownScale previewScale={previewScale} onPreviewScale={setPreviewScale} />
      )}
    </>
  );
}
