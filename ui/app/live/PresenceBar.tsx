'use client';

import type { Member } from '../../lib/api/generated/members';
import { useT } from '../i18n';
import { ShieldIcon } from '../icons';
import { nameOf } from '../names';
import { Avatar } from '../PersonPanel';
import { usePeople } from './people';
import { MAX_AVATARS, stateOf, type PresentPerson } from './presence';
import './presence.css';

// Everyone in the open tree right now, under the family name: one avatar per person with the email's initials, a
// shield for admins, idle people faded, and a tooltip with the email and what they do. Clicking someone else's
// avatar follows them; `following` is the email followed.
export default function PresenceBar({
  members,
  following,
  onFollow,
}: {
  members: Member[];
  following: string | null;
  onFollow: (email: string) => void;
}) {
  const t = useT();
  const people = usePeople();
  if (people.length === 0) return null;
  const shown = people.slice(0, people.length > MAX_AVATARS ? MAX_AVATARS - 1 : MAX_AVATARS);
  const hidden = people.slice(shown.length);

  function describe(person: PresentPerson) {
    const name = (id: string | null) => {
      const member = members.find((m) => m.id === id);
      return member ? nameOf(member, t.presence.unknownPerson) : t.presence.someone;
    };
    switch (stateOf(person)) {
      case 'idle':
        return t.presence.idle;
      case 'editing':
        return t.presence.editing(name(person.editing));
      case 'viewing':
        return t.presence.viewing(name(person.viewing));
      default:
        return t.presence.here;
    }
  }

  return (
    <ul className="presence-bar" aria-label={t.presence.label(people.length)}>
      {shown.map((person) => {
        const who = person.me ? t.presence.you(person.email) : person.email;
        const role = person.admin ? ` · ${t.presence.admin}` : '';
        const label = `${who}${role}: ${describe(person)}`;
        const avatar = (
          <>
            <Avatar member={{ initials: person.initials || '?' }} photo={null} />
            {person.admin && (
              <span className="presence-admin">
                <ShieldIcon />
              </span>
            )}
          </>
        );
        return (
          <li
            key={person.email}
            className="presence-person"
            data-idle={person.idle ? '' : undefined}
            data-me={person.me ? '' : undefined}
            data-following={person.email === following ? '' : undefined}
            tabIndex={person.me ? 0 : undefined}
            aria-label={person.me ? label : undefined}
          >
            {person.me ? (
              avatar
            ) : (
              <button
                type="button"
                className="presence-follow"
                aria-label={`${label}. ${t.presence.follow(person.email)}`}
                aria-pressed={person.email === following}
                onClick={() => onFollow(person.email)}
              >
                {avatar}
              </button>
            )}
            <span className="glass presence-tooltip" aria-hidden="true">
              <strong>{who}</strong>
              {role && <span>{t.presence.admin}</span>}
              <span>{describe(person)}</span>
              {!person.me && <span>{person.email === following ? t.presence.followingShort : t.presence.followHint}</span>}
            </span>
          </li>
        );
      })}
      {hidden.length > 0 && (
        <li className="presence-person presence-more" tabIndex={0} aria-label={t.presence.more(hidden.length)}>
          <span className="person-avatar">+{hidden.length}</span>
          <span className="glass presence-tooltip" aria-hidden="true">
            {hidden.map((person) => (
              <span key={person.email}>
                {person.email} · {describe(person)}
              </span>
            ))}
          </span>
        </li>
      )}
    </ul>
  );
}
