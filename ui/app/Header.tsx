'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { PUBLIC_APPEARANCE, themeOf, type Appearance, type Theme } from './access';
import { useAppearance } from './appearance';
import { useLanguage, useT, type Language } from './i18n';
import { CheckIcon, CloseIcon, EvolutionIcon } from './icons';
import { CARD_DENSITIES, useCardDensity } from './cardDensity';
import { useMotion, useReducedMotion } from './motion';
import { useCan, useMe, useMeLoaded } from './Permissions';
import { setLocationOn, useLocationOn } from './sunLocation';
import BrandLink from './home/BrandLink';
import { chipName } from './home/chipName';
import './header.css';

const THEMES: { theme: Theme; appearance: Appearance }[] = [
  { theme: '3d', appearance: 'organic' },
  { theme: 'tron', appearance: PUBLIC_APPEARANCE },
];

// 3D | GRID, in GRID (`tron`) with the animation toggle before it, in 3D with the location toggle in that place. Without `tree.appearance` only the public appearance is
// offered, the other is announced; choosing 3D from TRON leaves the tiered tree (see Evolution), choosing 3D while it is
// shown changes nothing.
export function ThemeSegment({ className }: { className?: string }) {
  const t = useT();
  const [appearance, setAppearance] = useAppearance();
  const mayChoose = useCan('tree.appearance');
  const locked = useMeLoaded() && !mayChoose;
  const current = themeOf(appearance);
  return (
    <>
      {current === 'tron' ? <MotionToggle /> : <LocationToggle />}
      <div className={`segment ${className ?? ''}`} role="group" aria-label={t.appearance.title}>
        {THEMES.map((option) => {
          const soon = locked && option.appearance !== PUBLIC_APPEARANCE;
          return (
            <button
              key={option.theme}
              type="button"
              aria-pressed={current === option.theme}
              disabled={soon}
              title={soon ? t.appearance.comingSoon : undefined}
              onClick={() => current !== option.theme && setAppearance(option.appearance)}
            >
              {t.appearance[option.appearance === 'organic' ? 'organic' : 'experimental']}
            </button>
          );
        })}
      </div>
    </>
  );
}

// Switches the TRON animations on and off (`motion.ts`), left of the theme segment and only in TRON. Switched on while
// the system reduces motion, a hint says why nothing moves and links to the FAQ entry on allowing motion.
function MotionToggle() {
  const t = useT();
  const [language] = useLanguage();
  const [motion, setMotion] = useMotion();
  const reduced = useReducedMotion();
  const [hint, setHint] = useState(false);
  const toggle = () => {
    setMotion(!motion);
    setHint(!motion && reduced);
  };
  return (
    <>
      <div className="segment">
        <button type="button" aria-pressed={motion} title={motion && reduced ? t.motion.reduced : t.motion.title} onClick={toggle}>
          {t.motion.label}
        </button>
      </div>
      {hint && (
        <div className="glass auth-notice motion-notice" role="status">
          <p>
            {t.motion.reducedHint} <Link href={`/home/faq?lang=${language}#animations`}>{t.motion.howTo}</Link>
          </p>
          <button type="button" className="auth-notice-close" aria-label={t.motion.close} onClick={() => setHint(false)}>
            <CloseIcon />
          </button>
        </div>
      )}
    </>
  );
}

// Lets the sun follow the browser's location instead of the time zone (`sunLocation.ts`); looks like `MotionToggle`. Only this
// click raises the browser's prompt; if the browser refuses, the toggle goes back off and a hint says why.
function LocationToggle() {
  const t = useT();
  const on = useLocationOn();
  const [refused, setRefused] = useState(false);
  const toggle = () => {
    setRefused(false);
    setLocationOn(!on, () => setRefused(true));
  };
  return (
    <>
      <div className="segment">
        <button type="button" aria-pressed={on} title={t.location.title} onClick={toggle}>
          {t.location.label}
        </button>
      </div>
      {refused && (
        <div className="glass auth-notice motion-notice" role="status">
          <p>{t.location.refused}</p>
          <button type="button" className="auth-notice-close" aria-label={t.location.close} onClick={() => setRefused(false)}>
            <CloseIcon />
          </button>
        </div>
      )}
    </>
  );
}

// S | M: how much the cards in the tree show (`cardDensity.ts`); only where there is a tree.
export function DensitySegment() {
  const t = useT();
  const [density, setDensity] = useCardDensity();
  return (
    <div className="segment header-density" role="group" aria-label={t.density.label} title={t.density.title}>
      {CARD_DENSITIES.map((option) => (
        <button key={option} type="button" aria-pressed={density === option} title={t.density[option]} onClick={() => setDensity(option)}>
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

const LANGUAGES: Language[] = ['de', 'en'];

// DE | EN.
export function LanguageSegment() {
  const t = useT();
  const [language, setLanguage] = useLanguage();
  return (
    <div className="segment" role="group" aria-label={t.language.label}>
      {LANGUAGES.map((option) => (
        <button key={option} type="button" aria-pressed={language === option} lang={option} onClick={() => setLanguage(option)}>
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// A status chip, not a button: shown while the person is signed in as an admin (`Me.admin` is true only in an admin session).
export function AdminBadge() {
  const t = useT();
  return (
    <span className="glass header-admin" title={t.menu.adminSession} aria-label={t.menu.adminSession} role="status">
      <CheckIcon />
      ADM
    </span>
  );
}

// The centred `user:family` like a shell prompt, in the tree's header and, signed in, on the landing page.
export function HeaderPrompt({ user, family, title, onClick }: { user: string | null; family: string; title: string; onClick: () => void }) {
  return (
    <button type="button" className="glass dashboard-family header-prompt" title={title} onClick={onClick}>
      {user && (
        <>
          <span className="header-prompt-user">{user}</span>
          <span className="header-prompt-sep">:</span>
        </>
      )}
      <span className="dashboard-family-name">{family}</span>
    </button>
  );
}

// The developers' Evolution button with its DEV badge; the signed-in header, the public pages, and the example share it.
export function EvolutionButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="glass header-button header-evolution" aria-expanded={open} aria-controls="evolution-panel" onClick={onClick}>
      <EvolutionIcon />
      <span className="header-evolution-label">{t.tools.evolution}</span>
      <span className="header-dev">DEV</span>
    </button>
  );
}

// The top of every signed-in screen: the wordmark with the developers' Evolution button and the admin badge beside it, the
// centred `user:family` like a shell prompt (it opens the family card; trees are switched on the families board), and on
// the right the theme and language segments and the burger menu (`menu`, rendered by `Dashboard`); the Evolution panel
// itself is drawn by `Scene`, under its button.
export default function Header({
  families,
  activeFamilyId,
  evolutionOpen,
  onEvolution,
  menu,
  onFamilyClick,
}: {
  families: FamilySummary[] | null;
  activeFamilyId: string | null;
  evolutionOpen: boolean;
  onEvolution: () => void;
  menu: ReactNode;
  // Opens the family card, or the families board while no family is shown.
  onFamilyClick: () => void;
}) {
  const t = useT();
  const evolution = useCan('dev.tools');
  const me = useMe();
  const admin = !!me?.admin;
  const activeFamily = families?.find((family) => family.id === activeFamilyId);
  const user = chipName(me);

  return (
    <header className="app-header">
      <div className="header-lead">
        <BrandLink />
        {evolution && <EvolutionButton open={evolutionOpen} onClick={onEvolution} />}
        {admin && <AdminBadge />}
      </div>
      <HeaderPrompt
        user={user}
        family={activeFamily?.name ?? t.menu.noFamily}
        title={activeFamily ? t.familyCard.open(activeFamily.name) : t.menu.families}
        onClick={onFamilyClick}
      />
      <div className="header-actions">
        <DensitySegment />
        <ThemeSegment className="header-theme" />
        <LanguageSegment />
        {menu}
      </div>
    </header>
  );
}
