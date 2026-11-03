'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import { takeRide, useRideReset } from '../ride';
import ThemeRoot from '../ThemeRoot';
import BrandLink from './BrandLink';
// Imported rather than in `public/`, so it ships under `/_next/static` with the rest of the page.
import still from './landing.jpg';
import HomeEvolution from './HomeEvolution';
import TronHorizon from './TronHorizon';
import { useSignedIn } from './signedIn';
import { PhaseStrip, StartButton, StartNote } from './Start';
import './landing.css';

// The landing page of the prototype (`docs/design/prototypes/Landing.dc.html`): the 3D still or the TRON grid behind a
// header, the claim with its two buttons, "Sign in" (signed in: "Go to the tree") and "How it works"; the steps and the
// example family live on `/home/how`. The header only holds what switches; who is signed in shows under the buttons.
export default function Landing() {
  const t = useT();
  const me = useSignedIn();
  const page = useRef<HTMLDivElement>(null);
  useRideReset();
  // The end of the ride back from a tree (`ride.ts`): the flash gives way, and the page builds itself up in scanlines
  // before the first paint.
  useLayoutEffect(() => {
    document.documentElement.classList.remove('riding-out');
    if (takeRide(true)) page.current?.classList.add('landing-arriving');
  }, []);
  return (
    // The rez animation takes its class off when done, so the later ones (the headline's flicker) run again.
    <div
      className="landing"
      ref={page}
      onAnimationEnd={(event) => event.animationName === 'tron-rez' && page.current?.classList.remove('landing-arriving')}
    >
      <ThemeRoot />
      <PhaseStrip me={me} />
      <div className="landing-backdrop" aria-hidden="true" style={{ '--landing-still': `url(${still.src})` } as CSSProperties} />
      <TronHorizon />
      <header className="landing-header">
        <div className="landing-brand-group">
          <BrandLink />
          <HomeEvolution me={me} />
        </div>
        <span />
        <div className="landing-segments">
          <ThemeSegment />
          <LanguageSegment />
        </div>
      </header>
      <main className="landing-hero">
        <h1>{t.landing.title}</h1>
        <p className="landing-chip">{t.landing.chip}</p>
        <p className="landing-lead">{t.landing.lead}</p>
        <div className="landing-actions">
          <StartButton me={me} />
          <Link className="glass landing-secondary" href="/home/how">
            {t.landing.how}
          </Link>
        </div>
        <StartNote me={me} />
      </main>
    </div>
  );
}
