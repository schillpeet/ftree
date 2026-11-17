'use client';

import { useEffect, useMemo } from 'react';
import { InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Texture, TextureLoader } from 'three';
import { ringTrees } from './clearing';
import ringColor from './forest/ring-color.png';
import ringNormal from './forest/ring-normal.png';
import ring from './forest/ring.json';

// The ring's trees are baked in Blender (docs/design/blender/forest.py) into one atlas: four cells of CELL_W × CELL_H
// side by side, each tree's foot at `foot` (pixels from its cell's top left, the trunk on the cell's centre line) and its
// top on the cell's top edge, so a tree of `height` metres has foot[1] / height pixels per metre.
const CELL_W = 1024;
const CELL_H = 2048;
const CELLS = ring.trees.length;
// The trees keep their modelled heights relative to each other around the ring's own height.
const MEAN_HEIGHT = ring.trees.reduce((sum, t) => sum + t.height, 0) / CELLS;

let atlas: { color: Texture; normal: Texture } | null = null;
function forestAtlas() {
  if (!atlas) {
    const load = (src: string) => {
      const texture = new TextureLoader().load(src);
      texture.anisotropy = 4;
      return texture;
    };
    atlas = { color: load(ringColor.src), normal: load(ringNormal.src) };
    atlas.color.colorSpace = SRGBColorSpace;
  }
  return atlas;
}

// The forest ring around the clearing: one quad per tree that only turns around its own vertical axis toward the
// camera (a cylindrical billboard), so its trunk stays upright; alpha is cut, so the trees write depth and hide the sun,
// and with multisampling it also sets coverage, so thin trunks and twigs keep smooth edges instead of breaking up.
// The camera stays inside the ring, so every tree is seen from the clearing and one view of it is enough.
function billboard(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cell;\nattribute float flip;')
      // A mirrored tree reads its cell from right to left; the quad itself is never mirrored, so its front stays in front.
      // The normal map's tangent frame follows the texture coordinates, so it is mirrored with them.
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>\nvMapUv.x = (mix(vMapUv.x, 1.0 - vMapUv.x, flip) + cell) / ${CELLS}.0;\nvNormalMapUv = vMapUv;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec3 foot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec2 toCamera = normalize(cameraPosition.xz - foot.xz);
// The camera's right, so the quad's front (counter-clockwise) faces it.
vec3 world = foot + vec3(toCamera.y, 0.0, -toCamera.x) * position.x * instanceMatrix[0].x + vec3(0.0, position.y * instanceMatrix[1].y, 0.0);
vec4 mvPosition = viewMatrix * vec4(world, 1.0);
gl_Position = projectionMatrix * mvPosition;
// Facing the camera and a little up; the normal map turns every tuft toward the sun or away from it.
vNormal = normalize((viewMatrix * vec4(toCamera.x, 0.3, toCamera.y, 0.0)).xyz);`,
      )
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(world, 1.0);');
  };
  return material;
}

export default function ForestRing({
  radius,
  top,
  heightAt,
}: {
  radius: number;
  // How high the ring's trees grow, before their own variation.
  top: number;
  heightAt: (x: number, z: number) => number;
}) {
  const mesh = useMemo(() => {
    const { color, normal } = forestAtlas();
    const trees = ringTrees(radius, top, CELLS);
    const quad = new PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    quad.setAttribute('cell', new InstancedBufferAttribute(new Float32Array(trees.map((t) => t.cell)), 1));
    quad.setAttribute('flip', new InstancedBufferAttribute(new Float32Array(trees.map((t) => (t.flip ? 1 : 0))), 1));
    const material = billboard(
      new MeshStandardMaterial({ map: color, normalMap: normal, alphaTest: 0.5, alphaToCoverage: true, roughness: 1, metalness: 0 }),
    );
    const mesh = new InstancedMesh(quad, material, trees.length);
    const m = new Matrix4();
    trees.forEach((t, i) => {
      const baked = ring.trees[t.cell];
      const size = (t.height * baked.height) / MEAN_HEIGHT;
      const perPixel = size / baked.foot[1];
      // The quad is the whole cell; its bottom lies below the foot by the pixels under it, and the foot 0.3 m in the ground.
      const below = (CELL_H - baked.foot[1]) * perPixel;
      mesh.setMatrixAt(i, m.makeScale(CELL_W * perPixel, CELL_H * perPixel, 1).setPosition(t.x, heightAt(t.x, t.z) - 0.3 - below, t.z));
    });
    // The shader moves every vertex, so the instances' own bounds mean nothing; the ring is around the camera anyway.
    mesh.frustumCulled = false;
    return mesh;
  }, [radius, top, heightAt]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  return <primitive object={mesh} />;
}
