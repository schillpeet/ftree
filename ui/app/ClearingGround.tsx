'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, Euler, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { bladeCount, GRASS, grassBlades } from './clearing';
import { groundGeometry } from './Meadow';
import type { PostTier } from './postEffects';
import { makeNoise, seededRandom } from './random';

// The Stufenbaum's ground (docs/superpowers/specs/2026-11-17-clearing-design.md): the clearing's floor in the darker
// half of the grass's colours, and blades of grass that bend in the wind, out to the forest ring.

const patches = makeNoise(2, 5);
// The wind's clock and strength, shared by the blades' shader; there is one clearing at a time.
const WIND = { uTime: { value: 0 }, uWind: { value: 0 } };

// A blade: 5 cm wide at the root, a point at the tip, curving forward; 1 m high, scaled per blade. Its normals point
// up, so blades take the light like the ground beneath them instead of showing as dark slivers.
function bladeGeometry() {
  const blade = new PlaneGeometry(1, 1, 1, 4);
  blade.translate(0, 0.5, 0);
  const pos = blade.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setXYZ(i, pos.getX(i) * 0.05 * (1 - y), y, 0.15 * y * y);
  }
  blade.setAttribute('normal', new Float32BufferAttribute(Array.from({ length: pos.count }, () => [0, 1, 0]).flat(), 3));
  return blade;
}

// Wind: a slow field of gusts travelling over the clearing and a quick flutter per blade; the tip moves most, the
// root not at all. The bend happens in world space, so all blades lean the same way.
function windy(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, WIND);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <project_vertex>',
        `vec4 world = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float tall = length(instanceMatrix[1].xyz);
float gust = 0.55 + 0.45 * sin(root.x * 0.07 + uTime * 1.1) * sin(root.z * 0.05 - uTime * 0.7);
float flutter = 0.12 * sin(uTime * 3.7 + root.x * 1.9 + root.z * 2.3);
float sway = uWind * tall * position.y * position.y * (gust + flutter);
world.xz += vec2(0.8, 0.6) * sway;
world.y -= 0.3 * sway * sway / max(tall, 0.01);
vec4 mvPosition = viewMatrix * world;
gl_Position = projectionMatrix * mvPosition;`,
      )
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = world;');
  };
  return material;
}

export default function ClearingGround({
  heightAt,
  radius,
  tier,
}: {
  heightAt: (x: number, z: number) => number;
  // How far the grass reaches: to the forest ring.
  radius: number;
  tier: PostTier;
}) {
  const ground = useMemo(() => {
    const dark = new Color(GRASS.dark);
    const darker = dark.clone().multiplyScalar(0.7);
    return groundGeometry(heightAt, (x, z, out) => out.lerpColors(darker, dark, 0.5 + 0.5 * patches(x * 0.12, z * 0.12)));
  }, [heightAt]);
  const blades = useMemo(() => {
    const count = bladeCount(tier);
    const mesh = new InstancedMesh(bladeGeometry(), windy(new MeshStandardMaterial({ roughness: 0.9, side: DoubleSide })), count);
    const rand = seededRandom(5);
    const [dark, light, c] = [new Color(GRASS.dark), new Color(GRASS.light), new Color()];
    const [m, p, q, e, s] = [new Matrix4(), new Vector3(), new Quaternion(), new Euler(), new Vector3()];
    grassBlades(count, radius).forEach(([x, z], i) => {
      p.set(x, heightAt(x, z) - 0.02, z);
      e.set((rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4);
      mesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s.set(1, GRASS.min + rand() * (GRASS.max - GRASS.min), 1)));
      mesh.setColorAt(i, c.lerpColors(dark, light, rand()).multiplyScalar(0.85 + 0.3 * patches(x * 0.05, z * 0.05) * 0.5));
    });
    mesh.receiveShadow = true;
    return mesh;
  }, [tier, radius, heightAt]);

  useEffect(() => () => ground.dispose(), [ground]);
  useEffect(
    () => () => {
      blades.geometry.dispose();
      (blades.material as MeshStandardMaterial).dispose();
      blades.dispose();
    },
    [blades],
  );
  useFrame(({ clock }) => {
    WIND.uTime.value = clock.elapsedTime;
    WIND.uWind.value = GRASS.wind;
  });

  return (
    <group>
      <mesh geometry={ground} rotation-x={-Math.PI / 2} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <primitive object={blades} />
    </group>
  );
}
