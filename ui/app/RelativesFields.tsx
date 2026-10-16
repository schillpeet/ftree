'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Member, Partnership, Relatives, Sibling } from '../lib/api/generated/members';
import { useT } from './i18n';

const fullName = (m: Member) => `${m.firstName} ${m.lastName}`;

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

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

// Assigns any number of parents, children, partners, and (half-)siblings to one member inside the member form.
// member is null for a new person. Reports the selection and whether it differs from the stored one.
export default function RelativesFields({
  member,
  members,
  onChange,
}: {
  member: Member | null;
  members: Member[];
  onChange: (relatives: Relatives, changed: boolean) => void;
}) {
  const t = useT();
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

  // extra renders next to an entry, e.g. the shared parent of a half-sibling.
  function list(
    legend: string,
    selected: string[],
    blocked: string[],
    onToggle: (id: string) => void,
    { hint, disabled, extra }: { hint?: string | false; disabled?: boolean; extra?: (m: Member) => ReactNode } = {},
  ) {
    const names = others.filter((m) => selected.includes(m.id)).map(fullName);
    // Collapsed to one line per relation; the checkbox list opens on click.
    return (
      <details className="relatives-picker">
        <summary>
          {names.length ? t.relatives.edit(legend) : t.relatives.assign(legend)}
          {names.length > 0 && <span>{names.join(', ')}</span>}
        </summary>
        <fieldset className="relatives-list" aria-label={legend} disabled={disabled}>
          {others.length === 0 && <p>{t.relatives.noOthers}</p>}
          {others.length > 0 && hint && <p>{hint}</p>}
          {others.map((m) => (
            <label key={m.id}>
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                disabled={blocked.includes(m.id)}
                onChange={() => onToggle(m.id)}
              />
              {fullName(m)}
              {extra?.(m)}
            </label>
          ))}
        </fieldset>
      </details>
    );
  }

  return (
    <div className="member-field-wide relatives-fields" role="group" aria-labelledby="relatives-heading">
      <h3 id="relatives-heading">{t.relatives.heading}</h3>
      {list(t.relatives.parents, parentIds, [...childIds, ...partnerIds, ...siblingIds], (id) => setParentIds((ids) => toggle(ids, id)))}
      {list(t.relatives.children, childIds, [...parentIds, ...partnerIds, ...siblingIds], (id) => setChildIds((ids) => toggle(ids, id)))}
      {list(t.relatives.partners, partnerIds, [...parentIds, ...childIds, ...siblingIds], (id) => setPartnerIds((ids) => toggle(ids, id)), {
        // Selected partners get their status and, when married, the wedding date.
        extra: (m) => {
          if (!partnerIds.includes(m.id)) return null;
          const { status, marriedOn } = detailsOf(details, m.id);
          return (
            <>
              <select
                aria-label={t.relatives.status(fullName(m))}
                value={status}
                onChange={(event) => setDetail(m.id, { status: event.target.value as Partnership['status'] })}
              >
                <option value="together">{t.relatives.together}</option>
                <option value="married">{t.relatives.married}</option>
              </select>
              {status === 'married' && (
                <input
                  type="date"
                  aria-label={t.relatives.marriedOn(fullName(m))}
                  value={marriedOn ?? ''}
                  onChange={(event) => setDetail(m.id, { marriedOn: event.target.value || null })}
                />
              )}
            </>
          );
        },
      })}
      {list(
        t.relatives.siblings,
        fullIds,
        [...parentIds, ...childIds, ...partnerIds, ...withOtherParents],
        (id) => setShared(id, fullIds.includes(id) ? [] : parentIds),
        { hint: parentIds.length === 0 && t.relatives.parentsFirst, disabled: parentIds.length === 0 },
      )}
      {/* Existing half-siblings can always be removed; adding one needs a second parent to leave out. */}
      {list(
        t.relatives.halfSiblings,
        halfIds,
        [
          ...parentIds,
          ...childIds,
          ...partnerIds,
          ...(parentIds.length < 2 ? others.filter((m) => !halfIds.includes(m.id)).map((m) => m.id) : []),
        ],
        (id) => setShared(id, halfIds.includes(id) ? [] : [parentIds[0]]),
        {
          hint: parentIds.length === 0 ? t.relatives.parentsFirst : parentIds.length === 1 && t.relatives.twoParentsFirst,
          disabled: parentIds.length === 0,
          extra: (m) =>
            parentIds.length >= 2 &&
            halfIds.includes(m.id) && (
              <select
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
