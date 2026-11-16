'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { DoubleSide, Group, Mesh, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader, Vector2, Vector3 } from 'three';
import barkColor from './bark/bark-color.jpg';
import barkGold from './bark/bark-gold.jpg';
import barkNormal from './bark/bark-normal.jpg';
import type { Point } from './pins';
import { buildTwinedTree } from './twinedForm';
import { blendPlans, type GrowingPlan } from './twinedGrowth';
import type { TwinedPlan } from './twinedLayout';

export { TWINED_SLOT_ANGLE } from './twinedForm';

// The twined tiered tree: an old tree with bark, and gold where the bark has come off. Its shape is
// a rule over the family (`twinedForm.ts`), its growth a plan between two family states
// (`twinedGrowth.ts`); this component draws the pieces and lets them grow.

// One growth step, in seconds.
export const GROW_SECONDS = 2.5;
// Before the first person's strand grows, a gold seed falls onto the hill (in seconds), then sinks in.
const SEED_SECONDS = 0.9;
const seedFrom = new Vector3();
// The baked bark is dark; this lifts it into the scene's light.
const BRIGHT = 1.7;

// The bark is baked in Blender (docs/design/blender) into three tiling textures: colour, relief, and
// one that marks the gold (red and blue) and how rough the surface is (green).
let barkMaps: { color: Texture; normal: Texture; gold: Texture } | null = null;
function bark() {
  if (!barkMaps) {
    const load = (src: string) => {
      const texture = new TextureLoader().load(src);
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.anisotropy = 8;
      return texture;
    };
    barkMaps = { color: load(barkColor.src), normal: load(barkNormal.src), gold: load(barkGold.src) };
    barkMaps.color.colorSpace = SRGBColorSpace;
  }
  return barkMaps;
}

const EMPTY: TwinedPlan = { depth: 0, braids: [], twigs: [], cards: [] };
const same = (a: TwinedPlan, b: TwinedPlan) => JSON.stringify(a) === JSON.stringify(b);

// Bark that is drawn only up to `grown` along each piece (see `Piece`); the clipped tube stays open.
// Where the bark is gone the wood is gold: half metal, so it still shows without reflections, and
// it glows a little.
function growingBark() {
  const { color, normal, gold } = bark();
  const material = new MeshStandardMaterial({
    map: color,
    normalMap: normal,
    normalScale: new Vector2(1.3, 1.3),
    roughnessMap: gold,
    metalnessMap: gold,
    roughness: 1,
    metalness: 0.55,
    side: DoubleSide,
  });
  const grown = { value: 1 };
  material.userData.grown = grown;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrown = grown;
    shader.vertexShader = `attribute float along;\nvarying float vAlong;\n${shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = along;')}`;
    shader.fragmentShader = `uniform float uGrown;\nvarying float vAlong;\n${shader.fragmentShader
      .replace('void main() {', 'void main() {\nif (vAlong > uGrown) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.42, 0.06) * texture2D(metalnessMap, vMetalnessMapUv).b * 0.3;')}`;
  };
  return material;
}

// The tree grows towards `target`: whenever it changes, new strands and twigs grow in, cards glide
// and the tree rises if a tier was added, over GROW_SECONDS. `replay` grows these plans one after
// the other from nothing. Without `animate` it jumps. Card pins are reported when a step has settled,
// so cards move once per step. Remount it (a `key`) to show another family without growing.
export default function TwinedTree({
  target,
  replay,
  animate,
  front,
  name,
  position,
  onPins,
  onReplayEnd,
}: {
  target: TwinedPlan;
  replay: TwinedPlan[] | null;
  animate: boolean;
  front: number;
  // The family's id, which shapes the base trunk.
  name: string;
  position: Point;
  onPins: (pins: Map<string, Point>) => void;
  onReplayEnd: () => void;
}) {
  const group = useRef<Group>(null);
  const seed = useRef<Mesh>(null);
  const callbacks = useRef({ onPins, onReplayEnd });
  const state = useRef({
    shown: null as TwinedPlan | null,
    queue: [] as TwinedPlan[],
    step: null as { from: TwinedPlan; to: TwinedPlan; start: number | null } | null,
    replaying: false,
    meshes: new Map<string, Mesh>(),
  });
  useEffect(() => {
    callbacks.current = { onPins, onReplayEnd };
  }, [onPins, onReplayEnd]);

  // Shows `plan`: one mesh per piece, reused by member id, grown as far as the plan says.
  const draw = (plan: TwinedPlan | GrowingPlan) => {
    const { pieces, pins } = buildTwinedTree(plan, front, name);
    const meshes = state.current.meshes;
    const ids = new Set(pieces.map((p) => p.id));
    for (const [id, mesh] of meshes)
      if (!ids.has(id)) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.removeFromParent();
        meshes.delete(id);
      }
    for (const p of pieces) {
      let mesh = meshes.get(p.id);
      if (!mesh) {
        mesh = new Mesh(p.geometry, growingBark());
        mesh.receiveShadow = true;
        meshes.set(p.id, mesh);
        group.current?.add(mesh);
      } else {
        mesh.geometry.dispose();
        mesh.geometry = p.geometry;
      }
      const material = mesh.material as MeshStandardMaterial;
      material.color.setScalar(BRIGHT * p.tint);
      const grown = 'grown' in plan ? (plan.grown.get(p.follows) ?? 1) : 1;
      material.userData.grown.value = grown;
      // The depth pass would cast the whole strand; shadows come once it has grown.
      mesh.castShadow = grown >= 1;
    }
    return pins;
  };

  useEffect(() => {
    const s = state.current;
    // Those who prefer less motion see the tree jump.
    const moving = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (s.shown === null || !moving) {
      s.queue = [];
      s.step = null;
      s.replaying = false;
      s.shown = target;
      callbacks.current.onPins(draw(target));
      if (replay) callbacks.current.onReplayEnd();
      return;
    }
    if (replay) {
      s.queue = [...replay];
      s.step = null;
      s.shown = EMPTY;
      s.replaying = true;
      callbacks.current.onPins(draw(EMPTY));
    } else {
      s.replaying = false;
      s.queue = [target];
    }
    // `draw` only depends on `front` and `name`, which never change (a new family remounts it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, replay, animate]);

  useEffect(() => {
    const meshes = state.current.meshes;
    return () => {
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
      }
      meshes.clear();
    };
  }, []);

  useFrame(({ clock }) => {
    const s = state.current;
    while (!s.step && s.queue.length) {
      const to = s.queue.shift()!;
      if (s.shown && !same(to, s.shown)) s.step = { from: s.shown, to, start: null };
    }
    if (!s.step) {
      if (seed.current) seed.current.visible = false;
      if (s.replaying) {
        s.replaying = false;
        callbacks.current.onReplayEnd();
      }
      return;
    }
    const step = s.step;
    step.start ??= clock.elapsedTime;
    const fall = step.from.braids.length ? 0 : SEED_SECONDS;
    const since = clock.elapsedTime - step.start;
    const t = Math.min(1, Math.max(0, since - fall) / GROW_SECONDS);
    if (seed.current) {
      const f = since / SEED_SECONDS;
      seed.current.visible = fall > 0 && f < 1.5;
      // An arc down to the foot of the tree, then it sinks into the hill while the roots grow out.
      // It comes from the front, a little to the side, so the viewer sees it fly in.
      seedFrom.set(Math.cos(front + 0.9) * 11, 16, Math.sin(front + 0.9) * 11);
      seed.current.position.copy(seedFrom).multiplyScalar(1 - Math.min(1, f) ** 2);
      seed.current.position.y += 3 * Math.sin(Math.PI * Math.min(1, f)) - 0.5 * Math.max(0, f - 1);
      seed.current.scale.setScalar(1 - Math.max(0, f - 1) * 2);
    }
    const pins = draw(blendPlans(step.from, step.to, t));
    if (t >= 1) {
      s.shown = step.to;
      s.step = null;
      callbacks.current.onPins(pins);
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh ref={seed} visible={false} scale={0}>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshStandardMaterial color="#c9a24a" metalness={0.8} roughness={0.35} emissive="#ff6b10" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
