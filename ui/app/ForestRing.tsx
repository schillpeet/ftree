'use client';

import { useEffect, useMemo } from 'react';
import { InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry } from 'three';
import { ringTrees } from './clearing';
import { PLACEHOLDER_CELLS, placeholderAtlas } from './ringPlaceholders';

// The forest ring around the clearing: one quad per tree that only turns around its own vertical axis toward the
// camera (a cylindrical billboard), so its trunk stays upright; alpha is cut, so the trees write depth and hide the sun,
// and with multisampling it also sets coverage, so thin trunks and twigs keep smooth edges instead of breaking up.
// The camera stays inside the ring, so every tree is seen from the clearing and one view of it is enough.
function billboard(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cell;\nattribute float flip;')
      // A mirrored tree reads its cell from right to left; the quad itself is never mirrored, so its front stays in front.
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv.x = (mix(vMapUv.x, 1.0 - vMapUv.x, flip) + cell) / ${PLACEHOLDER_CELLS}.0;`)
      .replace(
        '#include <project_vertex>',
        `vec3 foot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec2 toCamera = normalize(cameraPosition.xz - foot.xz);
// The camera's right, so the quad's front (counter-clockwise) faces it.
vec3 world = foot + vec3(toCamera.y, 0.0, -toCamera.x) * position.x * instanceMatrix[0].x + vec3(0.0, position.y * instanceMatrix[1].y, 0.0);
vec4 mvPosition = viewMatrix * vec4(world, 1.0);
gl_Position = projectionMatrix * mvPosition;
// Facing the camera and a little up, so the sky lights the crowns and a sun behind the ring leaves them dark.
vNormal = normalize((viewMatrix * vec4(toCamera.x, 0.6, toCamera.y, 0.0)).xyz);`,
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
  const atlas = useMemo(() => placeholderAtlas(), []);
  useEffect(() => () => atlas.dispose(), [atlas]);
  const mesh = useMemo(() => {
    const trees = ringTrees(radius, top, PLACEHOLDER_CELLS);
    const quad = new PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    quad.setAttribute('cell', new InstancedBufferAttribute(new Float32Array(trees.map((t) => t.cell)), 1));
    quad.setAttribute('flip', new InstancedBufferAttribute(new Float32Array(trees.map((t) => (t.flip ? 1 : 0))), 1));
    const material = billboard(new MeshStandardMaterial({ map: atlas, alphaTest: 0.5, alphaToCoverage: true, roughness: 1, metalness: 0 }));
    const ring = new InstancedMesh(quad, material, trees.length);
    const m = new Matrix4();
    trees.forEach((t, i) => {
      // A cell is half as wide as it is high.
      ring.setMatrixAt(i, m.makeScale(0.5 * t.height, t.height, 1).setPosition(t.x, heightAt(t.x, t.z) - 0.3, t.z));
    });
    // The shader moves every vertex, so the instances' own bounds mean nothing; the ring is around the camera anyway.
    ring.frustumCulled = false;
    return ring;
  }, [atlas, radius, top, heightAt]);

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
