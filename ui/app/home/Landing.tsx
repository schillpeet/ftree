'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import { GithubIcon } from '../icons';
import ThemeRoot from '../ThemeRoot';
import BrandLink from './BrandLink';
// Imported rather than in `public/`, so it ships under `/_next/static` with the rest of the page.
import still from './landing.jpg';
import HomeEvolution from './HomeEvolution';
import SignInChip from './SignInChip';
import { useSignedIn } from './signedIn';
import './landing.css';

// The landing page of the prototype (`docs/design/prototypes/Landing.dc.html`): the 3D still or the TRON grid behind a
// header, the claim with its two buttons. The three steps live on `/home/how`. Signed-in visitors get "Zu deinem Baum"
// instead of "Baum anlegen", and the header chip names them.
export default function Landing() {
  const t = useT();
  const signedIn = useSignedIn() !== null;
  return (
    <div className="landing">
      <ThemeRoot />
      <div className="landing-backdrop" aria-hidden="true" style={{ '--landing-still': `url(${still.src})` } as CSSProperties} />
      <header className="landing-header">
        <div className="landing-brand-group">
          <BrandLink />
          <HomeEvolution />
        </div>
        <nav className="glass landing-nav" aria-label={t.landing.home}>
          <Link href="/home/how">{t.landing.how}</Link>
        </nav>
        <div className="landing-segments">
          <SignInChip />
          <ThemeSegment />
          <LanguageSegment />
        </div>
      </header>
      <main className="landing-hero">
        <h1>{t.landing.title}</h1>
        <p className="landing-chip">
          {t.landing.chip}
          <a href="https://github.com/schillpeet" target="_blank" rel="noopener noreferrer" aria-label={t.landing.githubLabel}>
            <GithubIcon />
            schillpeet
          </a>
        </p>
        <p className="landing-lead">{t.landing.lead}</p>
        <div className="landing-actions">
          {/* A plain link: `/start` sits behind Cloudflare Access, which needs a full page load to sign in. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="landing-primary" href="/start">
            {signedIn ? t.landing.toTree : t.landing.plant}
          </a>
          <Link className="glass landing-secondary" href="/home/example">
            {t.landing.showExample}
          </Link>
        </div>
      </main>
    </div>
  );
}
