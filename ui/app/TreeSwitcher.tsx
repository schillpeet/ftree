'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FamilySummary } from '../lib/api/generated/members';
import { useT } from './i18n';
import { ChevronIcon, UsersIcon } from './icons';
import { switcherEntries } from './slugRoute';
import './treeRoute.css';

// The centred family name for people who see several trees: the name still opens the family card, the chevron beside
// it lists every visible tree, each a link to its own URL.
export default function TreeSwitcher({
  families,
  activeFamily,
  onFamilyClick,
}: {
  families: FamilySummary[];
  activeFamily: FamilySummary | null;
  onFamilyClick: () => void;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="glass dashboard-family tree-switcher" ref={ref}>
      <button
        type="button"
        className="tree-switcher-name"
        title={activeFamily ? t.familyCard.open(activeFamily.name) : t.menu.families}
        onClick={onFamilyClick}
      >
        <UsersIcon />
        <span className="dashboard-family-name">{activeFamily?.name ?? t.menu.noFamily}</span>
      </button>
      <button
        type="button"
        className="tree-switcher-toggle"
        aria-label={t.treeRoute.switch}
        aria-expanded={isOpen}
        aria-controls="tree-switcher-list"
        onClick={() => setIsOpen((open) => !open)}
      >
        <ChevronIcon />
      </button>
      {isOpen && (
        <nav className="tree-switcher-list" id="tree-switcher-list" aria-label={t.treeRoute.trees}>
          {switcherEntries(families, activeFamily?.id ?? null).map((entry) => (
            <Link
              key={entry.id}
              href={entry.href}
              className="tree-switcher-item"
              aria-current={entry.active ? 'page' : undefined}
              onClick={() => setIsOpen(false)}
            >
              {entry.name}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
