'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Member, Partnership, Relatives, Sibling } from '../lib/api/generated/members';
import { useT } from './i18n';
import { nameOf } from './names';
import { searchMembers } from './nameSearch';
import { RelativeChip } from './PersonPanel';
import { PlusIcon } from './icons';

// Siblings are not stored but derived from the parents others share with the selected ones. Edits override
// the parents a member is taken to have (empty: no longer a sibling); the member's own relatives never count.
function siblingsOf(others: Member[], parentIds: string[], related: string[], edits: Record<string, string[]>): Sibling[] {
  return others
    .filter((m) => !related.includes(m.id))
    .map((m) => ({ id: m.id, parentIds: (edits[m.id] ?? m.parentIds).filter((id) => parentIds.includes(id)) }))
    .filter((s) => s.parentIds.length > 0);
}

// Details per partner id; partners without an entry are only together.
type Details = Record<string, Omit<Partnership, 'partnerId'>>;
const detailsOf = (details: Details, id: string) => details[id] ?? { status: 'together' as const, marriedOn: null };
const detailsKey = (details: Details, ids: string[]) =>
  ids.map((id) => `${id}:${detailsOf(details, id).status}:${detailsOf(details, id).marriedOn ?? ''}`).sort().join(',');

const siblingKey = (s: Sibling) => `${s.id}:${[...s.parentIds].sort().join(',')}`;

// "Add parents" opens a small search instead of a list of everybody; picking someone adds them and closes it.
function AddRelative({
  label,
  options,
  disabled,
  onPick,
}: {
  label: string;
  options: Member[];
  disabled?: boolean;
  onPick: (id: string) => void;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = searchMembers(options, query, 6);
  const pick = (id: string) => {
    onPick(id);
    setIsOpen(false);
    setQuery('');
  };
  if (!isOpen) {
    return (
      <button type="button" className="person-add" disabled={disabled} onClick={() => setIsOpen(true)}>
        <PlusIcon />
        {label}
      </button>
    );
  }
  return (
    <div
      className="person-picker"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // Only the search closes, not the whole panel.
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        setQuery('');
      }}
    >
      <input
        autoFocus
        type="search"
        aria-label={label}
        placeholder={t.relatives.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (results[0]) pick(results[0].id);
          }
        }}
      />
      <ul>
        {query.trim() === '' && <li className="person-picker-hint">{t.relatives.typeName}</li>}
        {query.trim() !== '' && results.length === 0 && <li className="person-picker-hint">{t.relatives.noMatches}</li>}
        {results.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => pick(m.id)}>
              {nameOf(m, t.members.unknown)}
              <span>{[m.birthDate?.slice(0, 4), m.deathDate && `† ${m.deathDate.slice(0, 4)}`].filter(Boolean).join(' ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Assigns any number of parents, children, partners, and (half-)siblings to one member inside the person panel.
// member is null for a new person. Reports the selection and whether it differs from the stored one.
export default function RelativesFields({
  member,
  members,
  photoOf,
  onChange,
}: {
  member: Member | null;
  members: Member[];
  photoOf: (member: Member) => string | null | undefined;
  onChange: (relatives: Relatives, changed: boolean) => void;
}) {
  const t = useT();
  const fullName = (m: Member) => nameOf(m, t.members.unknown);
  const others = members.filter((m) => m.id !== member?.id);
  const [initial] = useState(() => {
    const parentIds = member?.parentIds ?? [];
    const partnerIds = member?.partnerIds ?? [];
    const childIds = member ? others.filter((m) => m.parentIds.includes(member.id)).map((m) => m.id) : [];
    return {
      parentIds,
      childIds,
      partnerIds,
      siblings: siblingsOf(others, parentIds, [...parentIds, ...childIds, ...partnerIds], {}),
      details: Object.fromEntries((member?.partnerships ?? []).map(({ partnerId, ...rest }) => [partnerId, rest])) as Details,
    };
  });
  const [parentIds, setParentIds] = useState(initial.parentIds);
  const [childIds, setChildIds] = useState(initial.childIds);
  const [partnerIds, setPartnerIds] = useState(initial.partnerIds);
  const [details, setDetails] = useState(initial.details);
  const setDetail = (id: string, detail: Partial<Details[string]>) =>
    setDetails((current) => ({ ...current, [id]: { ...detailsOf(current, id), ...detail } }));
  const [siblingEdits, setSiblingEdits] = useState<Record<string, string[]>>({});
  const siblings = siblingsOf(others, parentIds, [...parentIds, ...childIds, ...partnerIds], siblingEdits);
  const siblingIds = siblings.map((s) => s.id);
  // Siblings keep parents beyond the member's, so only those ending up with exactly the member's parents are full siblings.
  const withOtherParents = others.filter((m) => m.parentIds.some((id) => !parentIds.includes(id))).map((m) => m.id);
  const isFull = (s: Sibling) => s.parentIds.length === parentIds.length && !withOtherParents.includes(s.id);
  const fullIds = siblings.filter(isFull).map((s) => s.id);
  const halfIds = siblings.filter((s) => !isFull(s)).map((s) => s.id);
  const setShared = (id: string, ids: string[]) => setSiblingEdits((edits) => ({ ...edits, [id]: ids }));
  const differs = (ids: string[], before: string[]) => ids.length !== before.length || ids.some((id) => !before.includes(id));
  const changed =
    differs(parentIds, initial.parentIds) ||
    differs(childIds, initial.childIds) ||
    differs(partnerIds, initial.partnerIds) ||
    differs(siblings.map(siblingKey), initial.siblings.map(siblingKey)) ||
    detailsKey(details, partnerIds) !== detailsKey(initial.details, partnerIds);
  const partnerships = partnerIds.map((partnerId) => ({ partnerId, ...detailsOf(details, partnerId) }));
  // The form reads the latest selection on submit and dismiss; a ref there avoids re-rendering it.
  useEffect(() => onChange({ parentIds, childIds, partnerIds, siblings, partnerships }, changed));

  // extra renders next to a chip, e.g. the status of a partner or the shared parent of a half-sibling.
  function group(
    legend: string,
    addLabel: string,
    selected: string[],
    blocked: string[],
    onAdd: (id: string) => void,
    onRemove: (id: string) => void,
    { hint, disabled, extra }: { hint?: string | false; disabled?: boolean; extra?: (m: Member) => ReactNode } = {},
  ) {
    const chosen = others.filter((m) => selected.includes(m.id));
    const options = others.filter((m) => !selected.includes(m.id) && !blocked.includes(m.id));
    return (
      <section className="person-group" role="group" aria-label={legend}>
        <h3>{legend}</h3>
        <div className="person-chips person-chips-edit">
          {chosen.map((m) => (
            <span key={m.id} className="person-edit-item">
              <RelativeChip
                member={m}
                photo={photoOf(m)}
                onRemove={() => {
                  if (window.confirm(t.relatives.confirmRemove(fullName(m), legend))) onRemove(m.id);
                }}
              />
              {extra?.(m)}
            </span>
          ))}
          <AddRelative label={addLabel} options={options} disabled={disabled || options.length === 0} onPick={onAdd} />
        </div>
        {hint && <p className="person-muted">{hint}</p>}
      </section>
    );
  }
  const without = (ids: string[], id: string) => ids.filter((x) => x !== id);

  return (
    <div className="person-relatives-edit" role="group" aria-label={t.relatives.heading}>
      {group(
        t.relatives.parents,
        t.relatives.addParent,
        parentIds,
        [...childIds, ...partnerIds, ...siblingIds],
        (id) => setParentIds((ids) => [...ids, id]),
        (id) => setParentIds((ids) => without(ids, id)),
      )}
      {group(
        t.relatives.partners,
        t.relatives.addPartner,
        partnerIds,
        [...parentIds, ...childIds, ...siblingIds],
        (id) => setPartnerIds((ids) => [...ids, id]),
        (id) => setPartnerIds((ids) => without(ids, id)),
        {
          // Selected partners get their status and, when married, the wedding date.
          extra: (m) => {
            const { status, marriedOn } = detailsOf(details, m.id);
            return (
              <span className="person-partner-details">
                <select
                  aria-label={t.relatives.status(fullName(m))}
                  value={status}
                  onChange={(event) => setDetail(m.id, { status: event.target.value as Partnership['status'] })}
                >
                  <option value="together">{t.relatives.together}</option>
                  <option value="married">{t.relatives.married}</option>
                  <option value="separated">{t.relatives.separated}</option>
                </select>
                {status === 'married' && (
                  <input
                    type="date"
                    aria-label={t.relatives.marriedOn(fullName(m))}
                    value={marriedOn ?? ''}
                    onChange={(event) => setDetail(m.id, { marriedOn: event.target.value || null })}
                  />
                )}
              </span>
            );
          },
        },
      )}
      {group(
        t.relatives.children,
        t.relatives.addChild,
        childIds,
        [...parentIds, ...partnerIds, ...siblingIds],
        (id) => setChildIds((ids) => [...ids, id]),
        (id) => setChildIds((ids) => without(ids, id)),
      )}
      {group(
        t.relatives.siblings,
        t.relatives.addSibling,
        fullIds,
        [...parentIds, ...childIds, ...partnerIds, ...withOtherParents],
        (id) => setShared(id, parentIds),
        (id) => setShared(id, []),
        { hint: parentIds.length === 0 && t.relatives.parentsFirst, disabled: parentIds.length === 0 },
      )}
      {/* Existing half-siblings can always be removed; adding one needs a second parent to leave out. */}
      {group(
        t.relatives.halfSiblings,
        t.relatives.addHalfSibling,
        halfIds,
        [
          ...parentIds,
          ...childIds,
          ...partnerIds,
          ...(parentIds.length < 2 ? others.filter((m) => !halfIds.includes(m.id)).map((m) => m.id) : []),
        ],
        (id) => setShared(id, [parentIds[0]]),
        (id) => setShared(id, []),
        {
          hint: parentIds.length === 0 ? t.relatives.parentsFirst : parentIds.length === 1 && t.relatives.twoParentsFirst,
          disabled: parentIds.length === 0,
          extra: (m) =>
            parentIds.length >= 2 && (
              <select
                className="person-shared-parent"
                aria-label={t.relatives.sharedParent(fullName(m))}
                value={siblings.find((s) => s.id === m.id)?.parentIds[0]}
                onChange={(event) => setShared(m.id, [event.target.value])}
              >
                {parentIds.map((id) => (
                  <option key={id} value={id}>
                    {t.relatives.via(fullName(others.find((p) => p.id === id)!))}
                  </option>
                ))}
              </select>
            ),
        },
      )}
    </div>
  );
}
