'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import ThemeRoot from '../ThemeRoot';
import BrandLink from './BrandLink';
// Imported rather than in `public/`, so it ships under `/_next/static` with the rest of the page.
import still from './landing.jpg';
import { useSignedIn } from './signedIn';
import './landing.css';

// The landing page of the prototype (`docs/design/prototypes/Landing.dc.html`): the 3D still or the TRON grid behind a
// header, the claim with its two buttons, and three steps. Signed-in visitors get "Zu deinem Baum" instead of "Anmelden".
export default function Landing() {
  const t = useT();
  const signedIn = useSignedIn();
  return (
    <div className="landing">
      <ThemeRoot />
      <div className="landing-backdrop" aria-hidden="true" style={{ '--landing-still': `url(${still.src})` } as CSSProperties} />
      <header className="landing-header">
        <BrandLink />
        <nav className="glass landing-nav" aria-label={t.landing.home}>
          <a href="#steps">{t.landing.how}</a>
          <Link href="/privacy">{t.landing.privacy}</Link>
          <Link className="landing-nav-example" href="/home/example">
            {t.landing.example}
          </Link>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- `/start` needs a full load for Cloudflare Access */}
          <a href="/start">{signedIn ? t.landing.toTree : t.landing.signIn}</a>
        </nav>
        <div className="landing-segments">
          <ThemeSegment />
          <LanguageSegment />
        </div>
      </header>
      <main className="landing-hero">
        <p className="landing-chip">{t.landing.chip}</p>
        <h1>{t.landing.title}</h1>
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
      <ol id="steps" className="landing-steps">
        {t.landing.steps.map((step, i) => (
          <li key={step.title} className="glass">
            <span className="landing-step-number">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <strong>{step.title}</strong>
              {step.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
