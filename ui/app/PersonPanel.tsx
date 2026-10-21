'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Member } from '../lib/api/generated/members';
import { birthNameOf, formatDate, initialsOf } from './MembersControls';
import { ChevronLeftIcon, CloseIcon, DotsIcon, PencilIcon, PinIcon } from './icons';
import { onStorage, useT } from './i18n';
import { nameOf } from './names';
import { clampOffset, parsePin, type Offset } from './panelPosition';
import { relativesOf } from './relatives';

const yearOf = (value?: string | null) => value?.slice(0, 4) ?? '';

// "1935 – 2006", "1935" or "† 2006"; empty without any year.
export function lifeSpan(member: Member) {
  const born = yearOf(member.birthDate);
  const died = yearOf(member.deathDate);
  if (born && died) return `${born} – ${died}`;
  return born || (died && `† ${died}`) || '';
}

// Whole years between birth and death (or today); a person without a death date counts as living up to 110.
function ageOf(member: Member) {
  if (!member.birthDate) return null;
  const from = new Date(member.birthDate);
  const to = member.deathDate ? new Date(member.deathDate) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  let years = to.getFullYear() - from.getFullYear();
  if (to.getMonth() < from.getMonth() || (to.getMonth() === from.getMonth() && to.getDate() < from.getDate())) years -= 1;
  if (years < 0 || (!member.deathDate && years > 110)) return null;
  return years;
}

export function Avatar({ member, photo, large }: { member: Pick<Member, 'firstName' | 'lastName'>; photo: string | null | undefined; large?: boolean }) {
  const className = `person-avatar${large ? ' person-avatar-large' : ''}`;
  // Arbitrary user URLs: next/image would need every host configured.
  // eslint-disable-next-line @next/next/no-img-element
  if (photo) return <img className={className} src={photo} alt="" />;
  return (
    <span className={className} aria-hidden="true">
      {initialsOf(member)}
    </span>
  );
}

// A relative as a small card: avatar, name, and years. A button when it opens their profile; with onRemove
// it carries a × that takes the relation away.
export function RelativeChip({
  member,
  photo,
  onClick,
  onRemove,
  current,
}: {
  member: Member;
  photo: string | null | undefined;
  onClick?: () => void;
  onRemove?: () => void;
  // The person whose panel this is, shown for orientation next to their partners.
  current?: boolean;
}) {
  const t = useT();
  const name = nameOf(member, t.members.unknown);
  const years = lifeSpan(member);
  const content = (
    <>
      <Avatar member={member} photo={photo} />
      <span className="person-chip-text">
        <span className="person-chip-name">{name}</span>
        {years && <span className="person-chip-years">{years}</span>}
      </span>
    </>
  );
  return (
    <span className={`person-chip${current ? ' person-chip-current' : ''}`}>
      {onClick ? (
        <button type="button" className="person-chip-main" title={t.profile.open(name)} onClick={onClick}>
          {content}
        </button>
      ) : (
        <span className="person-chip-main">{content}</span>
      )}
      {onRemove && (
        <button type="button" className="person-chip-remove" aria-label={t.relatives.remove(name)} onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  );
}

const PIN_KEY = 'ftree.panelPin';

// The pinned panel position, remembered per browser; null while the panel is not pinned.
// The server render has no localStorage and starts unpinned.
export function usePanelPin() {
  const saved = useSyncExternalStore(onStorage, () => localStorage.getItem(PIN_KEY), () => null);
  const setPin = (next: Offset | null) => {
    try {
      if (next) localStorage.setItem(PIN_KEY, JSON.stringify(next));
      else localStorage.removeItem(PIN_KEY);
    } catch {
      return;
    }
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key: PIN_KEY }));
  };
  return [parsePin(saved), setPin] as const;
}

// The one panel for looking at and editing a person; it sits beside the tree, so the tree stays in view.
// It opens at the top centre (shifted by offset), can be dragged by its header unless pinned, and closes
// only on Escape or ×.
export function PanelShell({
  label,
  closeLabel,
  onClose,
  onBack,
  onEdit,
  onDelete,
  autoFocusClose,
  offset,
  onMove,
  pinned,
  onPinnedChange,
  children,
}: {
  label: string;
  closeLabel: string;
  onClose: () => void;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  autoFocusClose?: boolean;
  offset: Offset;
  onMove: (offset: Offset) => void;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  children: ReactNode;
}) {
  const t = useT();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // Pointer and offset where the current drag started, and where the panel sits without an offset.
  const drag = useRef<{ pointerX: number; pointerY: number; from: Offset; box: { left: number; top: number; width: number } } | null>(null);
  // Read through refs, so the listeners below are not re-attached on every render.
  const closeRef = useRef(onClose);
  const moveRef = useRef(onMove);
  const offsetRef = useRef(offset);
  useEffect(() => {
    closeRef.current = onClose;
    moveRef.current = onMove;
    offsetRef.current = offset;
  });

  // Escape also closes the panel while nothing has focus (e.g. after a click into the tree), but only the
  // topmost of several open panels; inside a panel its own key handler applies.
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active && active !== document.body && active.tagName !== 'CANVAS') return;
      const panels = document.querySelectorAll('.person-panel');
      if (panels[panels.length - 1] === panelRef.current) closeRef.current();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  // A remembered position may no longer fit a smaller window; move it back into view.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const from = offsetRef.current;
    const box = { left: rect.left - from.x, top: rect.top - from.y, width: rect.width };
    const fitted = clampOffset(from, box, { width: window.innerWidth, height: window.innerHeight });
    if (fitted.x !== from.x || fitted.y !== from.y) moveRef.current(fitted);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [isMenuOpen]);

  return (
    <aside
      className="glass person-panel"
      aria-label={label}
      ref={panelRef}
      tabIndex={-1}
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        if (isMenuOpen) setIsMenuOpen(false);
        else if (!event.defaultPrevented) onClose();
        // Handled here, so the document listener above leaves it alone.
        event.preventDefault();
      }}
    >
      <header
        className="person-header"
        data-draggable={!pinned}
        data-dragging={isDragging}
        onPointerDown={(event) => {
          if (pinned || event.button !== 0 || (event.target as Element).closest('button')) return;
          const rect = panelRef.current!.getBoundingClientRect();
          drag.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            from: offset,
            box: { left: rect.left - offset.x, top: rect.top - offset.y, width: rect.width },
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
          setIsDragging(true);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const next = { x: start.from.x + event.clientX - start.pointerX, y: start.from.y + event.clientY - start.pointerY };
          onMove(clampOffset(next, start.box, { width: window.innerWidth, height: window.innerHeight }));
        }}
        onPointerUp={() => {
          drag.current = null;
          setIsDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setIsDragging(false);
        }}
      >
        {onBack ? (
          <button type="button" className="person-icon-button" aria-label={t.profile.back} onClick={onBack}>
            <ChevronLeftIcon />
          </button>
        ) : (
          <span className="person-header-label">{label}</span>
        )}
        <span className="person-header-actions">
          {onEdit && (
            <button type="button" className="person-icon-button" aria-label={t.profile.edit} title={t.profile.edit} onClick={onEdit}>
              <PencilIcon />
            </button>
          )}
          <button
            type="button"
            className="person-icon-button person-pin"
            aria-pressed={pinned}
            aria-label={pinned ? t.profile.unpin : t.profile.pin}
            title={pinned ? t.profile.unpin : t.profile.pin}
            onClick={() => onPinnedChange(!pinned)}
          >
            <PinIcon />
          </button>
          {onDelete && (
            <span className="person-menu-anchor" ref={menuRef}>
              <button
                type="button"
                className="person-icon-button"
                aria-label={t.profile.more}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((open) => !open)}
              >
                <DotsIcon />
              </button>
              {isMenuOpen && (
                <div className="person-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDelete();
                    }}
                  >
                    {t.members.delete}
                  </button>
                </div>
              )}
            </span>
          )}
          <button type="button" className="person-icon-button" aria-label={closeLabel} autoFocus={autoFocusClose} onClick={onClose}>
            <CloseIcon />
          </button>
        </span>
      </header>
      <div className="person-body">{children}</div>
    </aside>
  );
}

// Read-only part of the panel: who the person is and how they are related. Clicking a relative shows them instead.
export function PersonView({
  member,
  photo,
  members,
  photoOf,
  onShow,
  error,
}: {
  member: Member;
  photo: string | null | undefined;
  members: Member[];
  photoOf: (member: Member) => string | null | undefined;
  onShow: (id: string) => void;
  error: string | null;
}) {
  const t = useT();
  const relatives = relativesOf(member, members);
  const age = ageOf(member);
  const span = lifeSpan(member);
  const birth = [formatDate(member.birthDate), member.birthPlace].filter(Boolean).join(' · ');
  const death = [formatDate(member.deathDate), member.deathPlace].filter(Boolean).join(' · ');
  const birthName = birthNameOf(member, t);
  const connectorOf = (id: string) => {
    const partnership = member.partnerships.find((p) => p.partnerId === id);
    if (partnership?.status === 'separated') return t.relatives.separated;
    if (partnership?.status !== 'married') return t.relatives.together;
    return `⚭ ${partnership.marriedOn ? t.profile.marriedSince(formatDate(partnership.marriedOn)!) : t.relatives.married}`;
  };
  const chips = (list: Member[]) =>
    list.map((m) => <RelativeChip key={m.id} member={m} photo={photoOf(m)} onClick={() => onShow(m.id)} />);
  const hasRelatives = [relatives.parents, relatives.children, relatives.partners, relatives.siblings, relatives.halfSiblings].some(
    (list) => list.length > 0,
  );
  const others: [string, Member[]][] = [
    [t.relatives.siblings, relatives.siblings],
    [t.relatives.halfSiblings, relatives.halfSiblings],
  ];

  return (
    <>
      <section className="person-hero">
        <Avatar member={member} photo={photo} large />
        <div className="person-hero-text">
          <h2 className="person-name">{nameOf(member, t.members.unknown)}</h2>
          {birthName && <p className="person-muted">{birthName}</p>}
          {(span || age !== null) && (
            <p className="person-muted">{[span, age !== null && t.profile.age(age)].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </section>
      {(birth || death) && (
        <dl className="person-facts">
          {birth && (
            <>
              <dt>{t.profile.born}</dt>
              <dd>{birth}</dd>
            </>
          )}
          {death && (
            <>
              <dt>{t.profile.died}</dt>
              <dd>{death}</dd>
            </>
          )}
        </dl>
      )}
      {member.note && <blockquote className="person-note">{member.note}</blockquote>}
      {error && <p className="person-error" role="alert">{error}</p>}

      <div className="person-family">
        {relatives.parents.length > 0 && (
          <section className="person-group" aria-label={t.relatives.parents}>
            <h3>{t.relatives.parents}</h3>
            <div className="person-chips">{chips(relatives.parents)}</div>
          </section>
        )}
        {relatives.partners.length > 0 && (
          <section className="person-group" aria-label={t.relatives.partners}>
            <h3>{t.relatives.partners}</h3>
            <div className="person-chips">
              <RelativeChip member={member} photo={photo} current />
              {relatives.partners.map((m) => (
                <span key={m.id} className="person-partner">
                  <span className="person-connector">{connectorOf(m.id)}</span>
                  <RelativeChip member={m} photo={photoOf(m)} onClick={() => onShow(m.id)} />
                </span>
              ))}
            </div>
          </section>
        )}
        {relatives.children.length > 0 && (
          <section className="person-group" aria-label={t.relatives.children}>
            <h3>{t.relatives.children}</h3>
            <div className="person-chips">{chips(relatives.children)}</div>
          </section>
        )}
        {others.map(
          ([label, list]) =>
            list.length > 0 && (
              <details key={label} className="person-group person-more">
                <summary>
                  {label} <span>{list.length}</span>
                </summary>
                <div className="person-chips">{chips(list)}</div>
              </details>
            ),
        )}
        {!hasRelatives && <p className="person-muted person-empty">{t.profile.noRelatives}</p>}
      </div>
    </>
  );
}
