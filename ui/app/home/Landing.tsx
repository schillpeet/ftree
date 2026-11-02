'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import ThemeRoot from '../ThemeRoot';
import BrandLink from './BrandLink';
// Imported rather than in `public/`, so it ships under `/_next/static` with the rest of the page.
import still from './landing.jpg';
import HomeEvolution from './HomeEvolution';
import SignInChip from './SignInChip';
import { useSignedIn } from './signedIn';
import { StartButton, StartNote } from './Start';
import './landing.css';

// The landing page of the prototype (`docs/design/prototypes/Landing.dc.html`): the 3D still or the TRON grid behind a
// header, the claim with its two buttons, "Plant a tree" (signed in: "Your tree") and "How it works"; the steps and the
// example family live on `/home/how`. The header only holds what switches; who is signed in shows under the buttons.
export default function Landing() {
  const t = useT();
  const me = useSignedIn();
  return (
    <div className="landing">
      <ThemeRoot />
      <div className="landing-backdrop" aria-hidden="true" style={{ '--landing-still': `url(${still.src})` } as CSSProperties} />
      <header className="landing-header">
        <div className="landing-brand-group">
          <BrandLink />
          <HomeEvolution me={me} />
        </div>
        <span />
        <div className="landing-segments">
          <SignInChip me={me} />
          <ThemeSegment />
          <LanguageSegment />
        </div>
      </header>
      <main className="landing-hero">
        <h1>{t.landing.title}</h1>
        <p className="landing-chip">{t.landing.chip}</p>
        <p className="landing-lead">{t.landing.lead}</p>
        <div className="landing-actions">
          <StartButton me={me} plant={t.landing.plant} />
          <Link className="glass landing-secondary" href="/home/how">
            {t.landing.how}
          </Link>
        </div>
        <StartNote me={me} />
      </main>
    </div>
  );
}
