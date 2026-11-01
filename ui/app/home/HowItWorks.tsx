'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import ThemeRoot from '../ThemeRoot';
import BackLink from './BackLink';
import BrandLink from './BrandLink';
import still from './landing.jpg';
import SignInChip from './SignInChip';
import './landing.css';

// "How it works": the landing look with a short intro, the three steps explained, and the two ways on.
export default function HowItWorks() {
  const t = useT();
  return (
    <div className="landing">
      <ThemeRoot />
      <div className="landing-backdrop landing-backdrop-dim" aria-hidden="true" style={{ '--landing-still': `url(${still.src})` } as CSSProperties} />
      <header className="landing-header">
        <div className="landing-brand-group">
          <BrandLink />
          <BackLink />
        </div>
        <span />
        <div className="landing-segments">
          <SignInChip />
          <ThemeSegment />
          <LanguageSegment />
        </div>
      </header>
      <main className="landing-how">
        <h1>{t.landing.howTitle}</h1>
        <p className="landing-lead">{t.landing.howLead}</p>
        <ol className="landing-steps">
          {t.landing.steps.map((step, i) => (
            <li key={step.title} className="glass">
              <span className="landing-step-number">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <strong>{step.title}</strong>
                <em>{step.text}</em>
                {step.detail}
              </span>
            </li>
          ))}
        </ol>
        <div className="landing-actions">
          {/* A plain link: `/start` sits behind Cloudflare Access, which needs a full page load to sign in. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="landing-primary" href="/start">
            {t.landing.plant}
          </a>
          <Link className="glass landing-secondary" href="/home/example">
            {t.landing.showExample}
          </Link>
        </div>
      </main>
    </div>
  );
}
