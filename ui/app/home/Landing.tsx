'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { can } from '../access';
import type { DashboardPanel } from '../Dashboard';
import FamiliesPanel from '../FamiliesPanel';
import { HeaderPrompt, LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import LegalGate from '../LegalGate';
import { KnownMe } from '../Permissions';
import ProfilePanel from '../ProfilePanel';
import { takeRide, useRideReset } from '../ride';
import ThemeRoot from '../ThemeRoot';
import BrandLink from './BrandLink';
import { chipName } from './chipName';
import HomeMenu from './HomeMenu';
import { useHomeFamilies } from './homeFamilies';
// Imported rather than in `public/`, so it ships under `/_next/static` with the rest of the page.
import still from './landing.jpg';
import HomeEvolution from './HomeEvolution';
import TronHorizon from './TronHorizon';
import { useSignedInState } from './signedIn';
import { PhaseStrip, StartButton, StartNote } from './Start';
import './landing.css';

// The landing page of the prototype (`docs/design/prototypes/Landing.dc.html`): the 3D still or the TRON grid behind a
// header, the claim with its two buttons, "Sign in" (signed in: "Go to the tree") and "How it works"; the steps and the
// example family live on `/home/how`. The header holds what switches and the burger menu; signed in, it also shows
// `user:family` like the tree, and the menu opens the profile and the families board over the page. Who is signed in
// also shows under the buttons. `feedbackEmail` is the operator's address, for the note on deleting the account.
export default function Landing({ feedbackEmail }: { feedbackEmail?: string }) {
  const t = useT();
  const [me, setMe] = useSignedInState();
  const home = useHomeFamilies(me);
  const [panel, setPanel] = useState<DashboardPanel | null>(null);
  const canFamilies = can(me ?? null, 'family.create');
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
        {me && home.families ? (
          <HeaderPrompt
            user={chipName(me)}
            family={home.current?.name ?? t.menu.noFamily}
            title={t.menu.families}
            onClick={() => setPanel(canFamilies ? 'families' : 'profile')}
          />
        ) : (
          <span />
        )}
        <div className="landing-segments">
          <ThemeSegment />
          <LanguageSegment />
          <HomeMenu signedIn={me === undefined ? undefined : !!me} canFamilies={canFamilies} onPanel={setPanel} />
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
      {me && (
        <KnownMe me={me} onMe={setMe}>
          {panel === 'profile' && (
            <ProfilePanel
              families={home.families}
              feedbackEmail={feedbackEmail}
              onOpenFamilies={canFamilies ? () => setPanel('families') : undefined}
              onClose={() => setPanel(null)}
            />
          )}
          <FamiliesPanel
            place="home"
            families={home.families}
            setFamilies={home.setFamilies}
            activeFamilyId={home.current?.id ?? null}
            isLoading={home.isLoading}
            error={home.failed ? t.families.loadFailed : null}
            isOpen={panel === 'families' && canFamilies}
            onClose={() => setPanel(null)}
            onRetry={home.retry}
            onSelect={home.choose}
            onOpen={() => {}}
            onToggleVisibility={home.choose}
            onAdded={(family) => {
              home.setFamilies((current) => [...(current ?? []).filter((item) => item.id !== family.id), family]);
              home.choose(family.id);
            }}
            // The form for a new family lives in the tree; `/start` opens it there (FamilyTree's `?create=1`).
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load through Access
            onCreate={() => location.assign('/start?create=1')}
          />
        </KnownMe>
      )}
      <LegalGate me={me} onAccepted={setMe} />
    </div>
  );
}
