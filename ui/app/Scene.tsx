'use client';

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, Sky } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Member } from '../lib/api/generated/members';
import { layoutScrolls } from './familyLayout';
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

function Scrolls({
  members,
  focus,
  controlsRef,
}: {
  members: Member[];
  focus: Focus;
  controlsRef: RefObject<CameraControls | null>;
}) {
  const { camera, events } = useThree();
  const positions = useMemo(() => {
    const layout = layoutScrolls(members);
    layout.forEach((p) => (p[1] += TREE_BASE));
    return layout;
  }, [members]);

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
  return members.map((member) => <Scroll key={member.id} member={member} position={positions.get(member.id)!} />);
}

export default function Scene({
  members,
  focus,
}: {
  members: Member[];
  focus: Focus;
}) {
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
      <Tree position={[0, TREE_BASE, 0]} />
      <Scrolls members={members} focus={focus} controlsRef={controlsRef} />
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
