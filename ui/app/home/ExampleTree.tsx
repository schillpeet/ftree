'use client';

import { useState } from 'react';
import { LanguageSegment, ThemeSegment } from '../Header';
import { useT } from '../i18n';
import { nameOf } from '../names';
import { lifeSpan } from '../PersonPanel';
import Scene from '../Scene';
import ThemeRoot from '../ThemeRoot';
import BrandLink from './BrandLink';
import { EXAMPLE_MEMBERS } from './exampleFamily';
import './landing.css';

const noop = () => {};

// The example family in the real scene, read-only: no BFF, no placing, no "+" slots; a click lights up the person's
// lineage and names them in a small card.
export default function ExampleTree() {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        evolutionOpen={false}
        onEvolutionClose={noop}
      />
      <header className="landing-header example-header">
        <BrandLink />
        <div className="glass example-title">
          <strong>{t.landing.exampleLabel}</strong>
          <span>{t.landing.exampleHint}</span>
        </div>
        <div className="landing-segments">
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
