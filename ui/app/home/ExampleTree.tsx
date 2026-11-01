'use client';

import { useState } from 'react';
import { AdminBadge, EvolutionButton, LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import { nameOf } from '../names';
import { lifeSpan } from '../PersonPanel';
import Scene from '../Scene';
import ThemeRoot from '../ThemeRoot';
import BackLink from './BackLink';
import BrandLink from './BrandLink';
import { EXAMPLE_MEMBERS } from './exampleFamily';
import SignInChip from './SignInChip';
import { hasDevTools, useSignedIn } from './signedIn';
import './landing.css';

// The example family in the real scene, read-only: no BFF, no placing, no "+" slots; a click lights up the person's
// lineage and names them in a small card.
export default function ExampleTree() {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const me = useSignedIn();
  const devTools = hasDevTools(me);
  const selected = EXAMPLE_MEMBERS.find((member) => member.id === selectedId) ?? null;
  return (
    <div className="example-page">
      <ThemeRoot />
      <Scene
        familyId={null}
        members={EXAMPLE_MEMBERS}
        focus={null}
        highlight={selectedId}
        onOpen={(id) => setSelectedId((current) => (current === id ? null : id))}
        evolutionOpen={evolutionOpen}
        devTools={devTools}
        onEvolutionClose={() => setEvolutionOpen(false)}
      />
      <header className="landing-header example-header">
        <div className="landing-brand-group">
          <BrandLink />
          {devTools && <EvolutionButton open={evolutionOpen} onClick={() => setEvolutionOpen(!evolutionOpen)} />}
          {me?.admin && <AdminBadge />}
          <BackLink />
        </div>
        <div className="glass example-title">
          <strong>{t.landing.exampleLabel}</strong>
          <span>{t.landing.exampleHint}</span>
        </div>
        <div className="landing-segments">
          <SignInChip />
          <ThemeSegment />
          <LanguageSegment />
        </div>
      </header>
      {selected && (
        <div className="glass example-person" role="status">
          <strong>{nameOf(selected, t.members.unknown)}</strong>
          {selected.birthName && <span>{t.landing.born(selected.birthName)}</span>}
          <span>{lifeSpan(selected)}</span>
        </div>
      )}
      {/* A full page load: `/start` sits behind Cloudflare Access, which signs in on navigation. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="landing-primary example-cta" href="/start">
        {t.landing.ownTree}
      </a>
    </div>
  );
}
