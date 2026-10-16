'use client';

import type { Member } from '../lib/api/generated/members';
import { birthNameOf, formatDate, initialsOf } from './MembersControls';
import { useT } from './i18n';
import { relativesOf } from './relatives';

const fullName = (m: Member) => `${m.firstName} ${m.lastName}`;

// Read-only profile of a member. Clicking a relative shows their profile instead; the person and
// their relatives are edited in the member form.
export default function ProfileDialog({
  member,
  photo,
  members,
  onShow,
  onEdit,
  onClose,
}: {
  member: Member;
  photo: string | null | undefined;
  members: Member[];
  onShow: (id: string) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const birth = [formatDate(member.birthDate), member.birthPlace].filter(Boolean).join(' · ');
  const death = [formatDate(member.deathDate), member.deathPlace].filter(Boolean).join(' · ');
  const relatives = relativesOf(member, members);
  const partnershipOf = (id: string) => {
    const partnership = member.partnerships.find((p) => p.partnerId === id);
    if (partnership?.status !== 'married') return t.relatives.together;
    return partnership.marriedOn ? t.profile.marriedSince(formatDate(partnership.marriedOn)!) : t.relatives.married;
  };
  const groups: [string, Member[]][] = [
    [t.relatives.parents, relatives.parents],
    [t.relatives.children, relatives.children],
    [t.relatives.partners, relatives.partners],
    [t.relatives.siblings, relatives.siblings],
    [t.relatives.halfSiblings, relatives.halfSiblings],
  ];

  return (
    <div
      className="member-dialog-backdrop"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      {/* tabIndex keeps focus (and so Escape) inside when clicking non-focusable parts. */}
      <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" tabIndex={-1}>
        <header className="member-dialog-header">
          <h2 id="profile-title">{fullName(member)}</h2>
          {/* Focused on open, so Escape reaches the backdrop's handler. */}
          <button className="member-dialog-close" type="button" aria-label={t.profile.close} autoFocus onClick={onClose}>
            ×
          </button>
        </header>
        <div className="profile">
          {photo ? (
            // Arbitrary user URLs: next/image would need every host configured.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="profile-photo" src={photo} alt={t.profile.photo(fullName(member))} />
          ) : (
            <span className="profile-photo profile-initials" aria-hidden="true">
              {initialsOf(member)}
            </span>
          )}
          <div>
            {birthNameOf(member, t) && <p>{birthNameOf(member, t)}</p>}
            {birth && <p>{t.profile.born}: {birth}</p>}
            {death && <p>{t.profile.died}: {death}</p>}
            {member.note && <p className="profile-note">{member.note}</p>}
          </div>
        </div>
        {groups.map(
          ([label, list]) =>
            list.length > 0 && (
              <section key={label} className="profile-relatives" aria-label={label}>
                <h3>{label}</h3>
                {list.map((m) => (
                  <button key={m.id} type="button" className="member-relatives-button" onClick={() => onShow(m.id)}>
                    {fullName(m)}
                    {list === relatives.partners && <span>{partnershipOf(m.id)}</span>}
                  </button>
                ))}
              </section>
            ),
        )}
        <div className="member-form-actions">
          <button type="button" onClick={onEdit}>
            {t.profile.edit}
          </button>
        </div>
      </section>
    </div>
  );
}
