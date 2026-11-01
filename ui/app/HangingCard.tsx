'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Group, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import type { Member } from '../lib/api/generated/members';
import { drawScroll, drawSign, papyrus, seedOf, wood, type CardText } from './cardTextures';
import { formatDate, photoSrc } from './MembersControls';
import { useT } from './i18n';
import { useOthersAt } from './live/people';
import PresenceDot from './live/PresenceDot';
import { isNameless, nameOf } from './names';
import type { Point } from './pins';
import { seededRandom } from './random';
import { CLICK_TOLERANCE } from './Scroll';
import { useTokenPaint } from './tokenColor';

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
  // The selected person's card glows softly; outside a highlighted lineage a card fades.
  selected?: boolean;
  dimmed?: boolean;
};

// Canvas pixels per world unit of card surface.
const PX = 160;
const SCROLL = { width: 2.9, height: 3.5, rope: 0.45 };
const SIGN = { width: 3.4, height: 2, depth: 0.12, rope: 0.7 };

const textOf = (m: Member, unknown: string): CardText => ({
  name: nameOf(m, unknown),
  unknown: isNameless(m),
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
  const text = textOf(member, useT().members.unknown);
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

// Soft warm glow drawn once and shared by every light orb.
function orbGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,246,220,0.9)');
  g.addColorStop(0.25, 'rgba(255,238,196,0.45)');
  g.addColorStop(0.6, 'rgba(255,222,164,0.12)');
  g.addColorStop(1, 'rgba(255,216,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
let glow: CanvasTexture | null = null;
const glowTexture = () => (glow ??= orbGlowTexture());

// A central orb plus a short chain along the card's top edge, seeded so every card glows a little
// differently. Positions are local to the card (the rod sits at y = −rope).
function orbLayout(width: number, rope: number, seed: number) {
  const rand = seededRandom(seed);
  const top = -rope + 0.45;
  const orb = (x: number, y: number, z: number, radius: number) => ({
    position: [x, y, z] as Point,
    radius,
    phase: rand() * Math.PI * 2,
  });
  return [
    orb(0, top, 0.12, 0.11),
    orb(width * 0.16, top + 0.16, 0.1, 0.085),
    orb(-width * 0.16, top + 0.16, 0.1, 0.085),
    orb(width * 0.33, top + 0.05, 0.06, 0.065),
    orb(-width * 0.33, top + 0.05, 0.06, 0.065),
  ];
}

// One little firefly: a bright core and an additive halo, bobbing and pulsing in place. Its size
// and brightness follow `evening`, so it rises and lights up as the sun sinks.
function GlowOrb({ position, radius, phase, evening }: { position: Point; radius: number; phase: number; evening: number }) {
  const ref = useRef<Group>(null);
  const halo = glowTexture();
  const scale = radius * (0.25 + 0.75 * evening);
  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 1.7 + phase) * 0.1;
    const bob = Math.sin(t * 0.9 + phase * 1.7) * 0.05;
    const drift = Math.sin(t * 0.6 + phase) * 0.07;
    group.position.set(position[0] + drift, position[1] + bob, position[2]);
    group.scale.setScalar(scale * pulse);
  });
  return (
    <group ref={ref}>
      <sprite scale={[4, 4, 1]} renderOrder={1}>
        <spriteMaterial
          map={halo}
          transparent
          opacity={evening}
          blending={AdditiveBlending}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </sprite>
      <mesh>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#fff6e0"
          transparent
          opacity={evening}
          blending={AdditiveBlending}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function GlowOrbs({ width, rope, seed, evening }: { width: number; rope: number; seed: number; evening: number }) {
  const orbs = useMemo(() => orbLayout(width, rope, seed), [width, rope, seed]);
  if (evening <= 0.001) return null;
  return (
    <group>
      {orbs.map((orb, i) => (
        <GlowOrb key={i} {...orb} evening={evening} />
      ))}
    </group>
  );
}

// Multiplies a dimmed card's colours: darker and greyer, like the faded scrolls.
const DIMMED = '#8f8a84';
const shade = (dimmed?: boolean) => (dimmed ? { color: DIMMED } : {});

// A soft halo in the theme's glow behind the selected card's sheet (local position and size).
function Halo({ position, width, height }: { position: Point; width: number; height: number }) {
  const glow = useTokenPaint('--glow');
  return (
    <sprite position={position} scale={[width * 1.8, height * 1.5, 1]}>
      <spriteMaterial
        map={glowTexture()}
        color={glow.color}
        opacity={glow.opacity}
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
    </sprite>
  );
}

// The presence dot at a card's upper right corner, only mounted while someone is there: every <Html> follows its
// card on each frame.
function CardPresence({ memberId, position }: { memberId: string; position: Point }) {
  if (useOthersAt(memberId).length === 0) return null;
  return (
    <Html position={position} center zIndexRange={[3, 0]}>
      <PresenceDot memberId={memberId} floating />
    </Html>
  );
}

// The "DU" badge on the own card's rod, like the presence dot an <Html> that follows the card.
function CardSelf({ position }: { position: Point }) {
  const t = useT();
  return (
    <Html position={position} center zIndexRange={[3, 0]}>
      <span className="self-badge self-badge-floating" data-self="">
        {t.tour.you}
      </span>
    </Html>
  );
}

// Papyrus scroll with a rod on top and a rolled-up bottom edge, written on both sides. 'label'
// turns to the camera and glows a little, so it stays readable against the low sun.
export function ScrollCard({ member, familyId, position, onOpen, onDrag, selected, dimmed, mode, evening, isSelf = false }: CardProps & { mode: 'scroll' | 'label'; evening: number; isSelf?: boolean }) {
  const seed = seedOf(member.id);
  const ref = useHanging(position, mode === 'label' ? 'face-camera' : 'sway', seed);
  const face = useCardTexture(member, familyId, SCROLL.width * PX, SCROLL.height * PX, drawScroll);
  const surface = plainTextures().papyrus;
  const glow = (mode === 'label' ? 0.45 : 0.08 + 0.42 * evening) * (dimmed ? 0.5 : 1);
  const { width, height, rope } = SCROLL;
  const sheetY = -rope - height / 2 - 0.02;
  return (
    <group ref={ref} position={position} {...pointerHandlers({ onOpen, onDrag })}>
      <GlowOrbs width={width} rope={rope} seed={seed} evening={evening} />
      {selected && <Halo position={[0, sheetY, -0.3]} width={width} height={height} />}
      <CardPresence memberId={member.id} position={[width / 2, -rope - 0.2, 0.15]} />
      {isSelf && <CardSelf position={[0, -rope + 0.22, 0.12]} />}
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
        <meshStandardMaterial map={face} emissiveMap={face} emissive="#ffffff" emissiveIntensity={glow} roughness={0.95} {...shade(dimmed)} />
      </mesh>
      <mesh geometry={BACK_SHEET} position={[0, sheetY, 0]} rotation={[0, Math.PI, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={face} emissiveMap={face} emissive="#ffffff" emissiveIntensity={glow} roughness={0.95} {...shade(dimmed)} />
      </mesh>
      <mesh position={[0, -rope - height - 0.06, -0.1]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.12, width + 0.02, 16]} />
        <meshStandardMaterial map={surface} emissiveMap={surface} emissive="#ffffff" emissiveIntensity={glow * 0.6} roughness={0.95} {...shade(dimmed)} />
      </mesh>
    </group>
  );
}

// Wooden board with burnt-in name and dates, the photo in a medallion beside them; written on
// both sides like the scroll.
export function SignCard({ member, familyId, position, onOpen, onDrag, selected, dimmed, evening, isSelf = false }: CardProps & { evening: number; isSelf?: boolean }) {
  const seed = seedOf(member.id);
  const ref = useHanging(position, 'sway', seed);
  const face = useCardTexture(member, familyId, SIGN.width * PX, SIGN.height * PX, drawSign);
  const surface = plainTextures().wood;
  const { width, height, depth, rope } = SIGN;
  // BoxGeometry faces: +x, −x, +y, −y, +z (front), −z (back).
  const maps = [surface, surface, surface, surface, face, face];
  return (
    <group ref={ref} position={position} {...pointerHandlers({ onOpen, onDrag })}>
      <GlowOrbs width={width} rope={rope} seed={seed} evening={evening} />
      {selected && <Halo position={[0, -rope - height / 2, -0.3]} width={width} height={height} />}
      <CardPresence memberId={member.id} position={[width / 2, -rope, depth]} />
      {isSelf && <CardSelf position={[0, -rope + 0.2, depth]} />}
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
            emissiveIntensity={(map === face ? 0.3 + 0.25 * evening : 0.15 + 0.15 * evening) * (dimmed ? 0.5 : 1)}
            roughness={0.85}
            {...shade(dimmed)}
          />
        ))}
      </mesh>
    </group>
  );
}
