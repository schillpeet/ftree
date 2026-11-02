'use client';

import { useEffect } from 'react';
import { themeOf } from './access';
import { useAppearance } from './appearance';
import { useMotion } from './motion';

// Puts the appearance's theme and whether the TRON animations play (`motion.ts`) on the root element; routes without
// this component (`/admin`, `/terms`) keep the `3d` default with the animations off.
export default function ThemeRoot() {
  const [appearance] = useAppearance();
  const theme = themeOf(appearance);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      document.documentElement.dataset.theme = '3d';
    };
  }, [theme]);
  const [motion] = useMotion();
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? 'on' : 'off';
    return () => {
      document.documentElement.dataset.motion = 'off';
    };
  }, [motion]);
  return null;
}
