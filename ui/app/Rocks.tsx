'use client';

import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, Euler, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rocks } from './clearing';
import { makeNoise, seededRandom } from './random';

// Rocks in the clearing for scale (docs/superpowers/specs/2026-11-17-clearing-design.md): four angular boulders made
// in code, each drawn instanced, flattened and sunk a third into the ground, dark blue-grey with some moss on their
// upper faces (chosen 2026-11-17).
const STONE = new Color('#4c535a');
const MOSS = new Color('#4d5a2a');
const MOSS_SHARE = 0.5;

// A unit rock: an icosphere pushed in and out by noise, so each of the four has its own lumps, then cut flat along a
// few seeded planes, like a boulder split off a cliff. Its vertex colours are the stone, turning to moss where the face
// looks up; the material shades it flat, so its edges show.
function rockGeometry(shape: number): BufferGeometry {
  const noise = makeNoise(20 + shape, 4);
  const fine = makeNoise(40 + shape, 3);
  const rand = seededRandom(60 + shape);
  const cuts = Array.from({ length: 6 }, () => {
    const n = new Vector3(rand() * 2 - 1, rand() * 1.4 - 0.4, rand() * 2 - 1).normalize();
    return { n, d: 0.55 + rand() * 0.3 };
  });
  const rock = mergeVertices(new IcosahedronGeometry(1, 2));
  const pos = rock.attributes.position;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const lump = 1 + 0.28 * noise(p.x * 1.3 + p.y, p.z * 1.3 - p.y) + 0.08 * fine(p.x * 4 + p.y * 2, p.z * 4);
    p.multiplyScalar(lump);
    for (const { n, d } of cuts) {
      const out = p.dot(n) - d;
      if (out > 0) p.addScaledVector(n, -out);
    }
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  rock.computeVertexNormals();
  const normals = rock.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const up = Math.min(1, Math.max(0, (normals.getY(i) - 0.45) / 0.4));
    c.copy(STONE).multiplyScalar(0.85 + 0.3 * (fine(pos.getX(i) * 6, pos.getZ(i) * 6) * 0.5 + 0.5)).lerp(MOSS, up * MOSS_SHARE);
    c.toArray(colors, i * 3);
  }
  rock.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return rock;
}

export default function Rocks({
  front,
  heightAt,
}: {
  // The start view's direction from the trunk; no rock stands in its way.
  front: number;
  heightAt: (x: number, z: number) => number;
}) {
  const meshes = useMemo(() => {
    const all = rocks(front);
    const [m, p, q, e, s] = [new Matrix4(), new Vector3(), new Quaternion(), new Euler(), new Vector3()];
    return [0, 1, 2, 3].flatMap((shape) => {
      const mine = all.filter((r) => r.shape === shape);
      if (!mine.length) return [];
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
      const mesh = new InstancedMesh(rockGeometry(shape), material, mine.length);
      mine.forEach((r, i) => {
        // A rock is `size` metres across, `squash` of that high, and a third of its height lies in the ground.
        const half = r.size / 2;
        p.set(r.x, heightAt(r.x, r.z) + half * r.squash * 0.33, r.z);
        mesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e.set(0, r.turn, 0)), s.set(half, half * r.squash, half * (0.8 + 0.2 * r.squash))));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return [mesh];
    });
  }, [front, heightAt]);

  useEffect(
    () => () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.dispose();
      }
    },
    [meshes],
  );

  return (
    <group>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  );
}
