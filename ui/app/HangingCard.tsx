'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { CanvasTexture, Group, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import type { Member } from '../lib/api/generated/members';
import { drawScroll, drawSign, papyrus, seedOf, wood, type CardText } from './cardTextures';
import { formatDate, photoSrc } from './MembersControls';
import type { Point } from './pins';
import { CLICK_TOLERANCE } from './Scroll';

// Member cards as real 3D objects hanging from their pin on two ropes: lit by the sun, casting
// shadows, and hidden behind leaves. Both must fit the card footprint `CARD` in pins.ts.

type PointerStart = { clientX: number; clientY: number };
type CardProps = {
  member: Member;
  familyId: string | null;
  // Where the ropes meet: right below the pin.
  position: Point;
  onOpen: () => void;
  onDrag?: (event: PointerStart) => void;
};

// Canvas pixels per world unit of card surface.
const PX = 160;
const SCROLL = { width: 2.9, height: 3.5, rope: 0.45 };
const SIGN = { width: 3.4, height: 2, depth: 0.12, rope: 0.7 };

const textOf = (m: Member): CardText => ({
  name: `${m.firstName} ${m.lastName}`,
  birth: formatDate(m.birthDate),
  death: formatDate(m.deathDate),
  note: m.note,
});

function canvasTexture(width: number, height: number, paint: (canvas: HTMLCanvasElement) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Text-free surfaces are the same for every card, so they are shared.
let plain: { papyrus: CanvasTexture; wood: CanvasTexture } | null = null;
const plainTextures = () =>
  (plain ??= {
    papyrus: canvasTexture(256, 310, (c) => papyrus(c.getContext('2d')!, 256, 310, 1)),
    wood: canvasTexture(256, 128, (c) => wood(c.getContext('2d')!, 256, 128, 1)),
  });

// The member's face of the card, redrawn once their photo has loaded. A photo that fails to load
// (or is served without CORS headers) is left out.
function useCardTexture(member: Member, familyId: string | null, width: number, height: number, draw: typeof drawScroll) {
  const text = textOf(member);
  const seed = seedOf(member.id);
  const key = JSON.stringify(text);
  const texture = useMemo(
    () => canvasTexture(width, height, (canvas) => draw(canvas, text, seed, null)),
    // `key` stands for `text`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, seed, width, height, draw],
  );
  const url = photoSrc(member, familyId);
  useEffect(() => {
    if (!url) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      draw(texture.image as HTMLCanvasElement, text, seed, image);
      texture.needsUpdate = true;
    };
    image.src = url;
    return () => {
      image.onload = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, url]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const UP = new Vector3(0, 1, 0);

// A rope as a thin lit cylinder between two local points.
function Rope({ from, to }: { from: Point; to: Point }) {
  const [a, b] = [new Vector3(...from), new Vector3(...to)];
  const direction = b.clone().sub(a);
  return (
    <mesh
      position={a.add(b).multiplyScalar(0.5)}
      quaternion={new Quaternion().setFromUnitVectors(UP, direction.clone().normalize())}
      castShadow
    >
      <cylinderGeometry args={[0.025, 0.025, direction.length(), 6]} />
      <meshStandardMaterial color="#8a6a3a" roughness={1} />
    </mesh>
  );
}

// 'sway': faces away from the trunk and swings gently around its pin, like something really
// hanging there. 'face-camera': turns around the vertical axis to the viewer, for legibility.
function useHanging(position: Point, motion: 'sway' | 'face-camera', seed: number) {
  const ref = useRef<Group>(null);
  const phase = seed % 628 / 100;
  useFrame(({ camera, clock }) => {
    const group = ref.current;
    if (!group) return;
    const [x, , z] = position;
    if (motion === 'face-camera') {
      group.rotation.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0);
      return;
    }
    const t = clock.elapsedTime;
    group.rotation.set(
      Math.sin(t * 0.9 + phase) * 0.04,
      Math.atan2(x, z) + Math.sin(t * 0.37 + phase) * 0.12,
      Math.sin(t * 1.1 + phase * 1.3) * 0.035,
      'YXZ',
    );
  });
  return ref;
}

function pointerHandlers({ onOpen, onDrag }: Pick<CardProps, 'onOpen' | 'onDrag'>) {
  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onDrag?.(event.nativeEvent);
    },
    // Only a press without movement opens the profile; anything more was a drag.
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (event.delta <= CLICK_TOLERANCE) onOpen();
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      document.body.style.cursor = onDrag ? 'grab' : 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
}

// Slightly cupped sheet, like paper that wants to roll up again. The back sheet is turned around
// and cupped the other way, so it lies just behind the front and its text reads correctly.
function sheet(cup: number) {
  const geometry = new PlaneGeometry(SCROLL.width, SCROLL.height, 24, 1);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, cup * (p.getX(i) / (SCROLL.width / 2)) ** 2 + (cup > 0 ? 0.004 : 0));
  geometry.computeVertexNormals();
  return geometry;
}
const FRONT_SHEET = sheet(-0.12);
const BACK_SHEET = sheet(0.12);

// Papyrus scroll with a rod on top and a rolled-up bottom edge, written on both sides. 'label'
// turns to the camera and glows a little, so it stays readable against the low sun.
export function ScrollCard({ member, familyId, position, onOpen, onDrag, mode }: CardProps & { mode: 'scroll' | 'label' }) {
  const seed = seedOf(member.id);
  const ref = useHanging(position, mode === 'label' ? 'face-camera' : 'sway', seed);
  const face = useCardTexture(member, familyId, SCROLL.width * PX, SCROLL.height * PX, drawScroll);
  const surface = plainTextures().papyrus;
  const glow = mode === 'label' ? 0.45 : 0.08;
  const { width, height, rope } = SCROLL;
  const sheetY = -rope - height / 2 - 0.02;
  return (
    <group ref={ref} position={position} {...pointerHandlers({ onOpen, onDrag })}>
      <Rope from={[0, 0, 0]} to={[-width / 2 - 0.05, -rope, 0]} />
      <Rope from={[0, 0, 0]} to={[width / 2 + 0.05, -rope, 0]} />
      <mesh position={[0, -rope, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, width + 0.2, 12]} />
        <meshStandardMaterial color="#6b3f1c" roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 + 0.17), -rope, 0]} castShadow>
          <sphereGeometry args={[0.11, 12, 8]} />
          <meshStandardMaterial color="#4f2c12" roughness={0.5} />
        </mesh>
      ))}
      <mesh geometry={FRONT_SHEET} position={[0, sheetY, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={face} emissiveMap={face} emissive="#ffffff" emissiveIntensity={glow} roughness={0.95} />
      </mesh>
      <mesh geometry={BACK_SHEET} position={[0, sheetY, 0]} rotation={[0, Math.PI, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={face} emissiveMap={face} emissive="#ffffff" emissiveIntensity={glow} roughness={0.95} />
      </mesh>
      <mesh position={[0, -rope - height - 0.06, -0.1]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.12, width + 0.02, 16]} />
        <meshStandardMaterial map={surface} emissiveMap={surface} emissive="#ffffff" emissiveIntensity={glow * 0.6} roughness={0.95} />
      </mesh>
    </group>
  );
}

// Wooden board with burnt-in name and dates, the photo in a medallion beside them; written on
// both sides like the scroll.
export function SignCard({ member, familyId, position, onOpen, onDrag }: CardProps) {
  const seed = seedOf(member.id);
  const ref = useHanging(position, 'sway', seed);
  const face = useCardTexture(member, familyId, SIGN.width * PX, SIGN.height * PX, drawSign);
  const surface = plainTextures().wood;
  const { width, height, depth, rope } = SIGN;
  // BoxGeometry faces: +x, −x, +y, −y, +z (front), −z (back).
  const maps = [surface, surface, surface, surface, face, face];
  return (
    <group ref={ref} position={position} {...pointerHandlers({ onOpen, onDrag })}>
      <Rope from={[0, 0, 0]} to={[-width / 2 + 0.15, -rope, 0]} />
      <Rope from={[0, 0, 0]} to={[width / 2 - 0.15, -rope, 0]} />
      <mesh position={[0, -rope - height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        {maps.map((map, i) => (
          <meshStandardMaterial
            key={i}
            attach={`material-${i}`}
            map={map}
            emissiveMap={map}
            emissive="#ffffff"
            emissiveIntensity={map === face ? 0.3 : 0.15}
            roughness={0.85}
          />
        ))}
      </mesh>
    </group>
  );
}
