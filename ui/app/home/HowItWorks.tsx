'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import type { FamilySummary } from '../../lib/api/generated/members';
import { LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import { rideFrom } from '../ride';
import ThemeRoot from '../ThemeRoot';
import BackLink from './BackLink';
import BrandLink from './BrandLink';
import still from './landing.jpg';
import HomeEvolution from './HomeEvolution';
import SignInChip from './SignInChip';
import TronHorizon from './TronHorizon';
import { useSignedIn } from './signedIn';
import { StartButton, StartNote } from './Start';
import { doneSteps } from './steps';
import './landing.css';

// Where each step leads: to the own tree, to it with the share dialog open, and to it again to add relatives.
const STEP_LINKS = ['/start', '/start?share=1', '/start'];

// "How it works": the landing look with a short intro, the three steps explained, and the two ways on. Signed in, the
// steps are links into the own tree and tick off what is done; signed out, only the first one leads on, to signing in.
export default function HowItWorks() {
  const t = useT();
  const me = useSignedIn();
  const router = useRouter();
  const [families, setFamilies] = useState<FamilySummary[] | null>(null);
  useEffect(() => {
    if (!me) return;
    let current = true;
    fetch('/api/families', { redirect: 'manual', cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<FamilySummary[]>) : null))
      .then((body) => {
        if (current && Array.isArray(body)) setFamilies(body);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [me]);
  const done = families ? doneSteps(families) : null;
  const next = done?.indexOf(false) ?? -1;
  return (
    <div className="landing landing-how-page">
      <ThemeRoot />
      <div className="landing-backdrop landing-backdrop-dim" aria-hidden="true" style={{ '--landing-still': `url(${still.src})` } as CSSProperties} />
      <TronHorizon dim tree={false} />
      <header className="landing-header">
        <div className="landing-brand-group">
          <BrandLink />
          <HomeEvolution me={me} />
          <BackLink />
        </div>
        <span />
        <div className="landing-segments">
          <SignInChip me={me} />
          <ThemeSegment />
          <LanguageSegment />
        </div>
      </header>
      <main className="landing-how">
        <h1>{t.landing.howTitle}</h1>
        <p className="landing-lead">{t.landing.howLead}</p>
        <ol className="landing-steps">
          {t.landing.steps.map((step, i) => {
            const isDone = !!done?.[i];
            const href = me ? STEP_LINKS[i] : i === 0 && me === null ? '/start' : null;
            const body = (
              <>
                <span className="landing-step-number" aria-label={isDone ? t.landing.stepDone : undefined}>
                  {isDone ? '✓' : String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <em>{step.text}</em>
                  {step.detail}
                </span>
              </>
            );
            return (
              <li key={step.title} className={`glass${isDone ? ' landing-step-done' : ''}${i === next ? ' landing-step-next' : ''}`}>
                {/* Plain links: `/start` sits behind Cloudflare Access, which needs a full page load to sign in. */}
                {href ? <a href={href}>{body}</a> : body}
              </li>
            );
          })}
        </ol>
        <div className="landing-actions">
          <StartButton me={me} plant={t.landing.plant} />
          <Link
            className="glass landing-secondary"
            href="/home/example"
            onClick={(event) => rideFrom(event, () => router.push('/home/example'))}
          >
            {t.landing.showExample}
          </Link>
        </div>
        <StartNote me={me} />
      </main>
    </div>
  );
}
