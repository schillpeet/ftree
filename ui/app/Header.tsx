'use client';

import type { ReactNode } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { PUBLIC_APPEARANCE, themeOf, type Appearance, type Theme } from './access';
import { useAppearance } from './appearance';
import { useLanguage, useT, type Language } from './i18n';
import { CheckIcon, EvolutionIcon, UsersIcon } from './icons';
import { useCan, useMe, useMeLoaded } from './Permissions';
import TreeSwitcher from './TreeSwitcher';
import BrandLink from './home/BrandLink';
import './header.css';

const THEMES: { theme: Theme; appearance: Appearance }[] = [
  { theme: '3d', appearance: 'organic' },
  { theme: 'tron', appearance: PUBLIC_APPEARANCE },
];

// 3D | TRON. Without `tree.appearance` only the public appearance is offered, the other is announced; choosing 3D from
// TRON leaves the tiered tree (see Evolution), choosing 3D while it is shown changes nothing.
export function ThemeSegment({ className }: { className?: string }) {
  const t = useT();
  const [appearance, setAppearance] = useAppearance();
  const mayChoose = useCan('tree.appearance');
  const locked = useMeLoaded() && !mayChoose;
  const current = themeOf(appearance);
  return (
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
// centred family name (with several trees a switcher sits beside it, and it opens the family card), and on the right the
// theme and language segments and the burger menu (`menu`, rendered by `Dashboard`); the Evolution panel itself is drawn by
// `Scene`, under its button.
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
  const admin = !!useMe()?.admin;
  const activeFamily = families?.find((family) => family.id === activeFamilyId);
  // Whoever sees more than one tree switches between them at the family name.
  const switchable = !!families && families.length > 1;

  return (
    <header className="app-header">
      <div className="header-lead">
        <BrandLink />
        {evolution && <EvolutionButton open={evolutionOpen} onClick={onEvolution} />}
        {admin && <AdminBadge />}
      </div>
      {switchable ? (
        <TreeSwitcher families={families ?? []} activeFamily={activeFamily ?? null} onFamilyClick={onFamilyClick} />
      ) : (
        <button
          type="button"
          className="glass dashboard-family"
          title={activeFamily ? t.familyCard.open(activeFamily.name) : t.menu.families}
          onClick={onFamilyClick}
        >
          <UsersIcon />
          <span className="dashboard-family-name">{activeFamily?.name ?? t.menu.noFamily}</span>
        </button>
      )}
      <div className="header-actions">
        <ThemeSegment className="header-theme" />
        <LanguageSegment />
        {menu}
      </div>
    </header>
  );
}
