'use client';

import type { Member } from '../lib/api/generated/members';
import { formatDate } from './MembersControls';
import { relativesOf } from './relatives';

const fullName = (m: Member) => `${m.firstName} ${m.lastName}`;

// Read-only profile of a member. Clicking a relative shows their profile instead; editing the
// person or their relatives happens in the existing dialogs.
export default function ProfileDialog({
  member,
  members,
  onShow,
  onEdit,
  onEditRelatives,
  onClose,
}: {
  member: Member;
  members: Member[];
  onShow: (id: string) => void;
  onEdit: () => void;
  onEditRelatives: () => void;
  onClose: () => void;
}) {
  const birth = [formatDate(member.birthDate), member.birthPlace].filter(Boolean).join(' · ');
  const death = [formatDate(member.deathDate), member.deathPlace].filter(Boolean).join(' · ');
  const relatives = relativesOf(member, members);
  const groups: [string, Member[]][] = [
    ['Eltern', relatives.parents],
    ['Kinder', relatives.children],
    ['Partner', relatives.partners],
    ['Geschwister', relatives.siblings],
    ['Halbgeschwister', relatives.halfSiblings],
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
          <button className="member-dialog-close" type="button" aria-label="Profil schließen" autoFocus onClick={onClose}>
            ×
          </button>
        </header>
        <div className="profile">
          {member.photoUrl && (
            // Arbitrary user URLs: next/image would need every host configured.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="profile-photo" src={member.photoUrl} alt={`Foto von ${fullName(member)}`} />
          )}
          <div>
            {birth && <p>Geboren: {birth}</p>}
            {death && <p>Verstorben: {death}</p>}
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
                  </button>
                ))}
              </section>
            ),
        )}
        <div className="member-form-actions">
          <button type="button" onClick={onEditRelatives}>
            Beziehungen zuweisen
          </button>
          <button type="button" onClick={onEdit}>
            Bearbeiten
          </button>
        </div>
      </section>
    </div>
  );
}
