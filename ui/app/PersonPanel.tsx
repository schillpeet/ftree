'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import type { Member } from '../lib/api/generated/members';
import { birthNameOf, formatDate, initialsOf } from './MembersControls';
import { ChevronIcon, ChevronLeftIcon, CloseIcon, PencilIcon, PinIcon, TrashIcon } from './icons';
import { onStorage, useT } from './i18n';
import PresenceHint from './live/PresenceHint';
import { nameOf } from './names';
import { sortPartners } from './partnerships';
import { clampOffset, parsePin, type Offset } from './panelPosition';
import { relativesOf } from './relatives';
import { CLICK_TOLERANCE } from './Scroll';

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

// `member` may also be ready-made initials, such as the ones the presence derives from an email.
export function Avatar({
  member,
  photo,
  large,
}: {
  member: Pick<Member, 'firstName' | 'lastName'> | { initials: string };
  photo: string | null | undefined;
  large?: boolean;
}) {
  const className = `person-avatar${large ? ' person-avatar-large' : ''}`;
  // Arbitrary user URLs: next/image would need every host configured.
  // eslint-disable-next-line @next/next/no-img-element
  if (photo) return <img className={className} src={photo} alt="" />;
  return (
    <span className={className} aria-hidden="true">
      {'initials' in member ? member.initials : initialsOf(member)}
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

// The pinned panel position, remembered per browser (one key per kind of panel); null while the
// panel is not pinned. The server render has no localStorage and starts unpinned.
export function usePanelPin(key = 'ftree.panelPin') {
  const saved = useSyncExternalStore(onStorage, () => localStorage.getItem(key), () => null);
  const setPin = (next: Offset | null) => {
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch {
      return;
    }
    // `storage` only fires in other tabs; tell this one too.
    window.dispatchEvent(new StorageEvent('storage', { key }));
  };
  return [parsePin(saved), setPin] as const;
}

// Lets a panel be dragged by its handle (spread the result onto the header) unless pinned; a drag
// keeps it grabbable (clampOffset), and a remembered position that no longer fits a smaller window
// moves back into view when the panel mounts.
export function usePanelDrag(panelRef: RefObject<HTMLElement | null>, offset: Offset, onMove: (offset: Offset) => void, pinned: boolean) {
  const [isDragging, setIsDragging] = useState(false);
  // Pointer and offset where the current drag started, and where the panel sits without an offset.
  const drag = useRef<{ pointerX: number; pointerY: number; from: Offset; box: { left: number; top: number; width: number } } | null>(null);
  // Read through refs, so the mount effect below sees the first values.
  const moveRef = useRef(onMove);
  const offsetRef = useRef(offset);
  useEffect(() => {
    moveRef.current = onMove;
    offsetRef.current = offset;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const from = offsetRef.current;
    const box = { left: rect.left - from.x, top: rect.top - from.y, width: rect.width };
    const fitted = clampOffset(from, box, { width: window.innerWidth, height: window.innerHeight });
    if (fitted.x !== from.x || fitted.y !== from.y) moveRef.current(fitted);
  }, [panelRef]);

  const stop = () => {
    drag.current = null;
    setIsDragging(false);
  };
  return {
    'data-draggable': !pinned,
    'data-dragging': isDragging,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
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
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const start = drag.current;
      if (!start) return;
      const next = { x: start.from.x + event.clientX - start.pointerX, y: start.from.y + event.clientY - start.pointerY };
      onMove(clampOffset(next, start.box, { width: window.innerWidth, height: window.innerHeight }));
    },
    onPointerUp: stop,
    onPointerCancel: stop,
  };
}

// The one panel for looking at and editing a person; it sits beside the tree, so the tree stays in view.
// It opens at the top centre (shifted by offset), can be dragged by its header unless pinned, and closes
// on Escape or ×; with closeOnOutsideClick also on a click (not a drag) outside every panel unless pinned.
// hideLabel leaves the label to screen readers, for a panel whose content says it all; its actions then
// float in the top-right corner, level with the content.
export function PanelShell({
  label,
  hideLabel,
  closeLabel,
  onClose,
  onBack,
  onEdit,
  onDelete,
  actions,
  autoFocusClose,
  closeOnOutsideClick,
  offset,
  onMove,
  pinned,
  onPinnedChange,
  className,
  children,
}: {
  label: string;
  hideLabel?: boolean;
  closeLabel: string;
  onClose: () => void;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  // Further actions, after edit and delete.
  actions?: ReactNode;
  autoFocusClose?: boolean;
  closeOnOutsideClick?: boolean;
  offset: Offset;
  onMove: (offset: Offset) => void;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  const t = useT();
  const bare = !!hideLabel && !onBack;
  const panelRef = useRef<HTMLElement>(null);
  const dragHandle = usePanelDrag(panelRef, offset, onMove, pinned);
  // Read through a ref, so the listeners below are not re-attached on every render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
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

  useEffect(() => {
    if (!closeOnOutsideClick || pinned) return;
    let start: { x: number; y: number } | null = null;
    const outside = (event: PointerEvent) => !(event.target as Element).closest?.('.person-panel');
    function down(event: PointerEvent) {
      start = event.button === 0 && outside(event) ? { x: event.clientX, y: event.clientY } : null;
    }
    function up(event: PointerEvent) {
      if (start && outside(event) && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= CLICK_TOLERANCE) {
        closeRef.current();
      }
      start = null;
    }
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
    };
  }, [closeOnOutsideClick, pinned]);

  return (
    <aside
      className={`glass person-panel${bare ? ' person-panel-bare' : ''}${className ? ` ${className}` : ''}`}
      aria-label={label}
      ref={panelRef}
      tabIndex={-1}
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        if (!event.defaultPrevented) onClose();
        // Handled here, so the document listener above leaves it alone.
        event.preventDefault();
      }}
    >
      <header className="person-header" data-bare={bare} {...dragHandle}>
        {onBack ? (
          <button type="button" className="person-icon-button" aria-label={t.profile.back} onClick={onBack}>
            <ChevronLeftIcon />
          </button>
        ) : (
          !hideLabel && <span className="person-header-label">{label}</span>
        )}
        {/* Pin (a view setting), edit (the main action), delete; close set apart at the end. */}
        <span className="person-header-actions">
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
          {onEdit && (
            <button
              type="button"
              className="person-icon-button person-edit"
              aria-label={t.profile.edit}
              title={t.profile.edit}
              onClick={onEdit}
            >
              <PencilIcon />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="person-icon-button person-delete"
              aria-label={t.members.delete}
              title={t.members.delete}
              onClick={onDelete}
            >
              <TrashIcon />
            </button>
          )}
          {actions}
          <span className="person-header-divider" aria-hidden="true" />
          <button
            type="button"
            className="person-icon-button"
            aria-label={closeLabel}
            title={closeLabel}
            autoFocus={autoFocusClose}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </span>
      </header>
      <div className="person-body">{children}</div>
    </aside>
  );
}

// The person with their partners: the current partner on the same row, every other partner on a row of
// their own, reached by a thin line that bends down from the person and carries the status. Former
// partners can be folded away, so only the current relationship shows.
function PartnerTree({
  member,
  photo,
  partners,
  photoOf,
  onShow,
  statusOf,
}: {
  member: Member;
  photo: string | null | undefined;
  partners: Member[];
  photoOf: (member: Member) => string | null | undefined;
  onShow: (id: string) => void;
  statusOf: (id: string) => string;
}) {
  const t = useT();
  const [showFormer, setShowFormer] = useState(true);
  const ordered = sortPartners(partners, member.partnerships);
  const isCurrent = (m: Member) => {
    const status = member.partnerships.find((p) => p.partnerId === m.id)?.status ?? 'together';
    return status === 'married' || status === 'together';
  };
  const inline = ordered[0] && isCurrent(ordered[0]) ? ordered[0] : null;
  const branches = ordered.filter((m) => m !== inline);
  const former = branches.filter((m) => !isCurrent(m));
  const shown = showFormer ? branches : branches.filter(isCurrent);
  return (
    <div className="person-partners">
      <div className="person-partner-row">
        <RelativeChip member={member} photo={photo} current />
        {inline && (
          <>
            <span className="person-connector">{statusOf(inline.id)}</span>
            <RelativeChip member={inline} photo={photoOf(inline)} onClick={() => onShow(inline.id)} />
          </>
        )}
      </div>
      {shown.length > 0 && (
        <ul className="person-partner-branches">
          {shown.map((m) => (
            <li key={m.id} className="person-partner-branch">
              <span className="person-branch-status">{statusOf(m.id)}</span>
              <RelativeChip member={m} photo={photoOf(m)} onClick={() => onShow(m.id)} />
            </li>
          ))}
        </ul>
      )}
      {former.length > 0 && (
        <button type="button" className="person-partner-toggle" aria-expanded={showFormer} onClick={() => setShowFormer((open) => !open)}>
          <ChevronIcon />
          {showFormer ? t.profile.hideFormer(former.length) : t.profile.showFormer(former.length)}
        </button>
      )}
    </div>
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
    const since = formatDate(partnership?.since);
    const married = formatDate(partnership?.marriedOn);
    const ended = formatDate(partnership?.endedOn);
    switch (partnership?.status) {
      case 'married':
        return `⚭ ${married ? t.profile.marriedSince(married) : t.relatives.married}`;
      case 'separated':
        return ended ? t.profile.separatedSince(ended) : t.relatives.separated;
      case 'divorced':
        return [ended ? t.profile.divorcedSince(ended) : t.relatives.divorced, married && `(⚭ ${married})`].filter(Boolean).join(' ');
      case 'widowed': {
        // Without a stored date, the partner's date of death says since when.
        const died = ended ?? formatDate(members.find((m) => m.id === id)?.deathDate);
        return [died ? t.profile.widowedSince(died) : t.relatives.widowed, married && `(⚭ ${married})`].filter(Boolean).join(' ');
      }
      default:
        return since ? t.profile.togetherSince(since) : t.relatives.together;
    }
  };
  const chips = (list: Member[]) =>
    list.map((m) => <RelativeChip key={m.id} member={m} photo={photoOf(m)} onClick={() => onShow(m.id)} />);
  // A parent who is not biological carries the kind of the link next to the chip.
  const parentChips = (list: Member[]) =>
    list.map((m) => {
      const kind = member.parentLinks.find((l) => l.parentId === m.id)?.kind ?? 'biological';
      return (
        <span key={m.id} className="person-parent">
          <RelativeChip member={m} photo={photoOf(m)} onClick={() => onShow(m.id)} />
          {kind !== 'biological' && <span className="person-parent-kind">{t.relatives.parentKinds[kind]}</span>}
        </span>
      );
    });
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
      <PresenceHint memberId={member.id} />
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
            <div className="person-chips">{parentChips(relatives.parents)}</div>
          </section>
        )}
        {relatives.partners.length > 0 && (
          <section className="person-group" aria-label={t.relatives.partners}>
            <h3>{t.relatives.partners}</h3>
            <PartnerTree member={member} photo={photo} partners={relatives.partners} photoOf={photoOf} onShow={onShow} statusOf={connectorOf} />
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
