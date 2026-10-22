'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Member, ParentLink, Partnership, Relatives, Sibling } from '../lib/api/generated/members';
import { useT } from './i18n';
import { nameOf } from './names';
import { searchMembers } from './nameSearch';
import { dateProblem, sortPartners, today } from './partnerships';
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
const detailsOf = (details: Details, id: string): Omit<Partnership, 'partnerId'> =>
  details[id] ?? { status: 'together', since: null, marriedOn: null, endedOn: null };
const detailsKey = (details: Details, ids: string[]) =>
  ids
    .map((id) => {
      const { status, since, marriedOn, endedOn } = detailsOf(details, id);
      return `${id}:${status}:${since ?? ''}:${marriedOn ?? ''}:${endedOn ?? ''}`;
    })
    .sort()
    .join(',');

// The relation groups, also naming what a person created from their search becomes.
export type Relation = 'parent' | 'partner' | 'child' | 'sibling' | 'halfSibling';

// The kind of each parent link by parent id; parents without an entry are biological.
type Kinds = Record<string, ParentLink['kind']>;
const kindsKey = (kinds: Kinds, ids: string[]) =>
  ids
    .map((id) => `${id}:${kinds[id] ?? 'biological'}`)
    .sort()
    .join(',');

const siblingKey = (s: Sibling) => `${s.id}:${[...s.parentIds].sort().join(',')}`;

// "Add parents" opens a small search instead of a list of everybody; picking someone adds them and closes it.
// With onCreate, the list ends with an entry that creates the typed name as a new person instead.
function AddRelative({
  label,
  options,
  disabled,
  onPick,
  onCreate,
}: {
  label: string;
  options: Member[];
  disabled?: boolean;
  onPick: (id: string) => void;
  onCreate?: (name: string) => void;
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
  const create = () => {
    onCreate?.(query.trim());
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
            else if (onCreate && query.trim() !== '') create();
          }
        }}
      />
      <ul>
        {query.trim() === '' && <li className="person-picker-hint">{t.relatives.typeName}</li>}
        {query.trim() !== '' && results.length === 0 && !onCreate && <li className="person-picker-hint">{t.relatives.noMatches}</li>}
        {results.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => pick(m.id)}>
              {nameOf(m, t.members.unknown)}
              <span>{[m.birthDate?.slice(0, 4), m.deathDate && `† ${m.deathDate.slice(0, 4)}`].filter(Boolean).join(' ')}</span>
            </button>
          </li>
        ))}
        {onCreate && query.trim() !== '' && (
          <li>
            <button type="button" className="person-picker-create" onClick={create}>
              <PlusIcon />
              {t.relatives.createNew(query.trim())}
            </button>
          </li>
        )}
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
  onCreate,
  linked,
}: {
  member: Member | null;
  members: Member[];
  photoOf: (member: Member) => string | null | undefined;
  onChange: (relatives: Relatives, changed: boolean) => void;
  // Creates a person from a search without matches; onCreated assigns them once they are saved.
  onCreate?: (name: string, relation: Relation, onCreated: (id: string) => void) => void;
  // The relation a new person is being created for, highlighted until that panel closes.
  linked?: Relation | null;
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
      kinds: Object.fromEntries((member?.parentLinks ?? []).map(({ parentId, kind }) => [parentId, kind])) as Kinds,
      details: Object.fromEntries((member?.partnerships ?? []).map(({ partnerId, ...rest }) => [partnerId, rest])) as Details,
    };
  });
  const [parentIds, setParentIds] = useState(initial.parentIds);
  const [childIds, setChildIds] = useState(initial.childIds);
  const [partnerIds, setPartnerIds] = useState(initial.partnerIds);
  const [details, setDetails] = useState(initial.details);
  const [kinds, setKinds] = useState(initial.kinds);
  const now = today();
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
    detailsKey(details, partnerIds) !== detailsKey(initial.details, partnerIds) ||
    kindsKey(kinds, parentIds) !== kindsKey(initial.kinds, parentIds);
  const partnerships = partnerIds.map((partnerId) => ({ partnerId, ...detailsOf(details, partnerId) }));
  // The form reads the latest selection on submit and dismiss; a ref there avoids re-rendering it.
  const parentLinks = parentIds.map((parentId) => ({ parentId, kind: kinds[parentId] ?? 'biological' }));
  useEffect(() => onChange({ parentIds, childIds, partnerIds, siblings, partnerships, parentLinks }, changed));

  // extra renders next to a chip, e.g. the status of a partner or the shared parent of a half-sibling.
  function group(
    kind: Relation,
    legend: string,
    addLabel: string,
    selected: string[],
    blocked: string[],
    onAdd: (id: string) => void,
    onRemove: (id: string) => void,
    {
      hint,
      disabled,
      extra,
      sort = (list) => list,
    }: { hint?: string | false; disabled?: boolean; extra?: (m: Member) => ReactNode; sort?: (list: Member[]) => Member[] } = {},
  ) {
    const chosen = sort(others.filter((m) => selected.includes(m.id)));
    const options = others.filter((m) => !selected.includes(m.id) && !blocked.includes(m.id));
    return (
      <section className="person-group" role="group" aria-label={legend} data-relation={kind} data-linked={linked === kind || undefined}>
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
          <AddRelative
            label={addLabel}
            options={options}
            disabled={disabled || (options.length === 0 && !onCreate)}
            onPick={onAdd}
            onCreate={onCreate && ((name) => onCreate(name, kind, onAdd))}
          />
        </div>
        {hint && <p className="person-muted">{hint}</p>}
      </section>
    );
  }
  const without = (ids: string[], id: string) => ids.filter((x) => x !== id);

  return (
    <div className="person-relatives-edit" role="group" aria-label={t.relatives.heading}>
      {group(
        'parent',
        t.relatives.parents,
        t.relatives.addParent,
        parentIds,
        [...childIds, ...partnerIds, ...siblingIds],
        (id) => setParentIds((ids) => [...ids, id]),
        (id) => {
          setParentIds((ids) => without(ids, id));
          // A parent added again starts as biological.
          setKinds((current) => Object.fromEntries(Object.entries(current).filter(([parentId]) => parentId !== id)));
        },
        {
          // Each selected parent gets the kind of the link, biological unless changed.
          extra: (m) => (
            <span className="person-partner-details">
              <select
                aria-label={t.relatives.parentKind(fullName(m))}
                value={kinds[m.id] ?? 'biological'}
                onChange={(event) => setKinds((current) => ({ ...current, [m.id]: event.target.value as ParentLink['kind'] }))}
              >
                {(Object.keys(t.relatives.parentKinds) as ParentLink['kind'][]).map((kind) => (
                  <option key={kind} value={kind}>
                    {t.relatives.parentKinds[kind]}
                  </option>
                ))}
              </select>
            </span>
          ),
        },
      )}
      {group(
        'partner',
        t.relatives.partners,
        t.relatives.addPartner,
        partnerIds,
        [...parentIds, ...childIds, ...siblingIds],
        (id) => setPartnerIds((ids) => [...ids, id]),
        (id) => setPartnerIds((ids) => without(ids, id)),
        {
          // In the order the profile shows them, by the stored details, so chips do not jump while editing;
          // partners added here count as together until saved.
          sort: (list) => sortPartners(list, member?.partnerships ?? []),
          // Selected partners get their status and the dates that go with it.
          extra: (m) => {
            const partnership = detailsOf(details, m.id);
            const { status, since, marriedOn, endedOn } = partnership;
            // Dates cannot lie in the future, and a divorce not before the wedding. Marked here and refused on
            // saving with a message; no min/max, whose browser check would silently block saving from the other tab.
            const problem = dateProblem(partnership, now);
            const date = (
              caption: string,
              label: string,
              value: string | null | undefined,
              field: 'since' | 'marriedOn' | 'endedOn',
            ) => (
              <label className="person-partner-date">
                <span>{caption}</span>
                <input
                  type="date"
                  aria-label={label}
                  aria-invalid={!!value && (value > now || (problem === 'divorceBeforeWedding' && field === 'endedOn'))}
                  value={value ?? ''}
                  onChange={(event) => setDetail(m.id, { [field]: event.target.value || null })}
                />
              </label>
            );
            return (
              <span className="person-partner-details">
                <select
                  aria-label={t.relatives.status(fullName(m))}
                  value={status}
                  onChange={(event) => {
                    const next = event.target.value as Partnership['status'];
                    // Widowed starts from the partner's date of death when none is set yet.
                    setDetail(m.id, next === 'widowed' && !endedOn ? { status: next, endedOn: m.deathDate ?? null } : { status: next });
                  }}
                >
                  <option value="together">{t.relatives.together}</option>
                  <option value="married">{t.relatives.married}</option>
                  <option value="separated">{t.relatives.separated}</option>
                  <option value="divorced">{t.relatives.divorced}</option>
                  <option value="widowed">{t.relatives.widowed}</option>
                </select>
                {status === 'together' && date(t.relatives.sinceCaption, t.relatives.since(fullName(m)), since, 'since')}
                {(status === 'married' || status === 'divorced' || status === 'widowed') &&
                  date(t.relatives.weddingCaption, t.relatives.marriedOn(fullName(m)), marriedOn, 'marriedOn')}
                {status === 'separated' && date(t.relatives.sinceCaption, t.relatives.endedOn(fullName(m)), endedOn, 'endedOn')}
                {status === 'divorced' &&
                  date(t.relatives.divorceCaption, t.relatives.endedOn(fullName(m)), endedOn, 'endedOn')}
                {status === 'widowed' && date(t.relatives.deathCaption, t.relatives.endedOn(fullName(m)), endedOn, 'endedOn')}
              </span>
            );
          },
        },
      )}
      {group(
        'child',
        t.relatives.children,
        t.relatives.addChild,
        childIds,
        [...parentIds, ...partnerIds, ...siblingIds],
        (id) => setChildIds((ids) => [...ids, id]),
        (id) => setChildIds((ids) => without(ids, id)),
      )}
      {group(
        'sibling',
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
        'halfSibling',
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
          disabled: parentIds.length < 2,
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
