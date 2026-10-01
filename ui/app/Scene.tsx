'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import Meadow, { height } from './Meadow';
import Tree from './Tree';

// Low sun in view, left behind the tree: warm side light and long shadows across the meadow.
const SUN: [number, number, number] = [-120, 16, -50];
// The sky's sun sits even lower (~1.5°) so the shader shows a real sunset glow; at that angle
// the light itself would graze the ground and leave it black.
const SKY_SUN: [number, number, number] = [-60, 0.8, -25];
const HAZE = '#b98a86';
const TREE_BASE = height(0, 0);

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

export default function Scene() {
  return (
    <Canvas
      shadows="percentage"
      // Lower exposure keeps the bright sky shader from washing out to white; lights compensate.
      gl={{ toneMappingExposure: 0.6 }}
      camera={{ position: [40, TREE_BASE + 15, 50], fov: 50, far: 10000 }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <SunsetSky />
      <Meadow />
      <Tree position={[0, TREE_BASE, 0]} />
      <OrbitControls target={[0, TREE_BASE + 9, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={150} />
    </Canvas>
  );
}
