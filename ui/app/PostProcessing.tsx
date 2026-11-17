'use client';

import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, GodRays, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { HalfFloatType, Scene, type Mesh } from 'three';
import { useAppearance } from './appearance';
import { useStoredSwitch } from './lines';
import { POST_KEY, startTier, type PostTier } from './postEffects';

// The composer's frame callback; any priority above 0 also stops R3F's own render of the scene.
const COMPOSER_PRIORITY = 1;
// The overlay draws after the composer, on top of its finished image.
const OVERLAY_PRIORITY = COMPOSER_PRIORITY + 1;
// After this many changes between the tiers the tier stays as it is.
const TIER_CHANGES = 3;

// The lab's "Post effects" switch; on unless switched off, remembered per browser.
export const usePostEffects = () => useStoredSwitch(POST_KEY, true);

// Without the composer glowing things skip tone mapping and are drawn as they are; with it they pass through its tone
// mapping like everything else, and this much more light keeps them as bright as before and lets them reach the bloom.
const GLOW_GAIN = 8;

// How much brighter glowing things are drawn while the post effects run: by default enough for the light orbs and
// the card halos to bloom; the moon asks for less, just enough to stay as bright as before.
export function useGlowGain(gain = GLOW_GAIN) {
  const [post] = usePostEffects();
  // The same condition as the scene's: TRON never runs the post effects.
  const experimental = useAppearance()[0] === 'experimental';
  return post && !experimental ? gain : 1;
}

const COARSE_POINTER = '(pointer: coarse)';

const onPointerChange = (listener: () => void) => {
  const query = matchMedia(COARSE_POINTER);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};

// The tier this device starts at; the server render assumes a fine pointer.
export function useStartTier(): PostTier {
  return startTier(useSyncExternalStore(onPointerChange, () => matchMedia(COARSE_POINTER).matches, () => false));
}

// Ambient occlusion, bloom, tone mapping and a vignette for the 3D appearances. A falling frame rate steps down to medium,
// a recovered one back to where this device started. With a `sun` disc in the scene, light shafts fall from it through
// whatever stands in front of it (the clearing, docs/superpowers/specs/2026-11-17-clearing-design.md).
export function PostEffects({ start, sun = null }: { start: PostTier; sun?: Mesh | null }) {
  const [declined, setDeclined] = useState(false);
  const changes = useRef(0);
  const tier = declined ? 'medium' : start;
  // The monitor reports a steady frame rate as inclines too, so only real changes count; after a few the tier stays
  // where it is instead of rebuilding the composer again and again.
  const change = (next: boolean) => {
    if (next === declined || changes.current >= TIER_CHANGES) return;
    changes.current += 1;
    setDeclined(next);
  };
  return (
    <PerformanceMonitor onDecline={() => change(true)} onIncline={() => change(false)}>
      {/* Keyed, so a tier change builds a fresh composer instead of patching passes and multisampling. */}
      <EffectComposer key={tier} renderPriority={COMPOSER_PRIORITY} frameBufferType={HalfFloatType} multisampling={tier === 'high' ? 4 : 0}>
        {tier === 'high' && <N8AO halfRes aoRadius={2} intensity={2} />}
        {/* Only bright HDR highlights bloom: the light orbs, the card halos, and a small halo around the sun. */}
        <Bloom mipmapBlur luminanceThreshold={3} luminanceSmoothing={0.5} intensity={0.5} radius={0.4} />
        {sun ? <GodRays sun={sun} samples={80} density={0.97} decay={0.96} weight={0.9} exposure={1.2} clampMax={1} blur /> : <></>}
        {/* The same ACES the renderer uses without the composer: the bark, leaves and cards were tuned under it. */}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.45} />
      </EffectComposer>
    </PerformanceMonitor>
  );
}

// Draws its children after the composer straight onto the canvas, so they keep their exact colours:
// no ambient occlusion, bloom, tone mapping or vignette.
export function Overlay({ children }: { children: ReactNode }) {
  const scene = useMemo(() => new Scene(), []);
  useFrame(({ gl, camera }) => {
    const autoClear = gl.autoClear;
    // Keep the composer's image; only the depth goes, which the overlay would otherwise test against.
    gl.autoClear = false;
    gl.setRenderTarget(null);
    gl.clearDepth();
    gl.render(scene, camera);
    gl.autoClear = autoClear;
  }, OVERLAY_PRIORITY);
  return createPortal(children, scene);
}
