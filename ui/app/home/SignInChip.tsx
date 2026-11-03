'use client';

import { useT } from '../i18n';
import { chipName, type ChipMe } from './chipName';
import './landing.css';

// "Signed in as …": plain text on a glass chip, not a link, since the person is signed in already.
export function SignedInChip({ me }: { me: ChipMe | null }) {
  const t = useT();
  const name = chipName(me);
  if (!name) return null;
  return <span className="glass landing-status landing-status-static">{t.landing.signedInAs(name)}</span>;
}
