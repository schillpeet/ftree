'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, Sky } from '@react-three/drei';
import { Vector2, Vector3, type Mesh } from 'three';
import type { Member, Position } from '../lib/api/generated/members';
import Meadow, { height } from './Meadow';
import Scroll from './Scroll';
import Tree from './Tree';

// Low sun in view, left behind the tree: warm side light and long shadows across the meadow.
const SUN: [number, number, number] = [-120, 16, -50];
// The sky's sun sits even lower (~1.5°) so the shader shows a real sunset glow; at that angle
// the light itself would graze the ground and leave it black.
const SKY_SUN: [number, number, number] = [-60, 0.8, -25];
const HAZE = '#b98a86';
const TREE_BASE = height(0, 0);
const CAMERA_START: [number, number, number] = [40, TREE_BASE + 15, 50];
const CAMERA_TARGET: [number, number, number] = [0, TREE_BASE + 9, 0];
// Pinned scrolls float this far off the bark so they don't sink into it.
const BARK_OFFSET = 0.6;
const FOCUS_DISTANCE = 12;

export type Focus = { id: string } | null;

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

// Unpinned scrolls wait in a row on the meadow in front of the tree.
function scrollPosition(member: Member, unpinnedIndex: number): [number, number, number] {
  if (member.position) return [member.position.x, member.position.y, member.position.z];
  const x = 6 + unpinnedIndex * 4;
  const z = 12;
  return [x, height(x, z) + 3, z];
}

function Scrolls({
  members,
  focus,
  barkRef,
  controlsRef,
  onMove,
}: {
  members: Member[];
  focus: Focus;
  barkRef: RefObject<Mesh | null>;
  controlsRef: RefObject<CameraControls | null>;
  onMove: (member: Member, position: Position) => void;
}) {
  const { camera, gl, raycaster, events } = useThree();
  const [drag, setDrag] = useState<{ id: string; at: [number, number, number] | null } | null>(null);

  let unpinned = 0;
  const positions = new Map(members.map((m) => [m.id, scrollPosition(m, m.position ? 0 : unpinned++)]));

  useEffect(() => {
    const member = focus && members.find((m) => m.id === focus.id);
    const controls = controlsRef.current;
    if (!member || !controls) return;
    const [x, y, z] = positions.get(member.id)!;
    // Keep the current viewing direction, just move close to the scroll.
    const eye = camera.position.clone().sub(controls.getTarget(new Vector3())).setLength(FOCUS_DISTANCE).add(new Vector3(x, y, z));
    void controls.setLookAt(eye.x, eye.y, eye.z, x, y, z, true);
    // Only a new focus request should move the camera, not later member changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Listeners go on synchronously at grab time, so even a fast drag can't finish before they exist.
  function grab(member: Member) {
    const pointer = new Vector2();
    let at: [number, number, number] | null = null;
    setDrag({ id: member.id, at });

    // ponytail: raycasts the full merged bark on every move; add a BVH if dragging gets sluggish.
    function move(event: PointerEvent) {
      const bark = barkRef.current;
      if (!bark) return;
      const rect = gl.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(bark)[0];
      if (hit?.face) {
        const p = hit.face.normal.clone().transformDirection(bark.matrixWorld).multiplyScalar(BARK_OFFSET).add(hit.point);
        at = [p.x, p.y, p.z];
      } else {
        at = null;
      }
      setDrag({ id: member.id, at });
    }

    function release() {
      window.removeEventListener('pointermove', move);
      if (at) onMove(member, { x: at[0], y: at[1], z: at[2] });
      setDrag(null);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', release, { once: true });
  }

  // drei's Html loses its content if its target changes after mount, so wait until the
  // canvas has connected its event source (the element Html attaches to).
  if (!events.connected) return null;
  return members.map((member) => (
    <Scroll
      key={member.id}
      member={member}
      position={(drag?.id === member.id && drag.at) || positions.get(member.id)!}
      dragging={drag?.id === member.id}
      onGrab={(event) => {
        event.preventDefault();
        // The camera controls listen on the same container; don't let them orbit while dragging.
        event.stopPropagation();
        grab(member);
      }}
    />
  ));
}

export default function Scene({
  members,
  focus,
  onMove,
}: {
  members: Member[];
  focus: Focus;
  onMove: (member: Member, position: Position) => void;
}) {
  const barkRef = useRef<Mesh>(null);
  const controlsRef = useRef<CameraControls>(null);
  // Stable callback, so the start view is only applied once when the controls mount.
  const initControls = useCallback((controls: CameraControls | null) => {
    controlsRef.current = controls;
    void controls?.setLookAt(...CAMERA_START, ...CAMERA_TARGET, false);
  }, []);

  return (
    <Canvas
      shadows="percentage"
      // Lower exposure keeps the bright sky shader from washing out to white; lights compensate.
      gl={{ toneMappingExposure: 0.6 }}
      camera={{ position: CAMERA_START, fov: 50, far: 10000 }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <SunsetSky />
      <Meadow />
      <Tree position={[0, TREE_BASE, 0]} barkRef={barkRef} />
      <Scrolls members={members} focus={focus} barkRef={barkRef} controlsRef={controlsRef} onMove={onMove} />
      <CameraControls
        ref={initControls}
        makeDefault
        maxPolarAngle={Math.PI / 2.1}
        minDistance={8}
        maxDistance={150}
      />
    </Canvas>
  );
}
