'use client';

import { useEffect } from 'react';
import { themeOf } from './access';
import { useAppearance } from './appearance';

// Puts the appearance's theme on the root element; routes without this component (`/admin`, `/terms`) keep the `3d` default.
export default function ThemeRoot() {
  const [appearance] = useAppearance();
  const theme = themeOf(appearance);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      document.documentElement.dataset.theme = '3d';
    };
  }, [theme]);
  return null;
}
