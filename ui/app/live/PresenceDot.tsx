'use client';

import { useT } from '../i18n';
import { PencilIcon } from '../icons';
import { whoOf } from './liveEvents';
import { useOthersAt } from './people';
import './presence.css';

// A mini avatar at a person's card while someone else views or edits them: the first one's initials, "+n" for the
// rest, and a pencil while anyone edits. Faded when everyone there is idle. Reads the presence store, so it works
// inside drei's <Html>; `floating` when that <Html> places it instead of a positioned card around it.
export default function PresenceDot({ memberId, floating }: { memberId: string; floating?: boolean }) {
  const t = useT();
  const others = useOthersAt(memberId);
  if (others.length === 0) return null;
  const [first] = others;
  const editing = first.editing === memberId;
  const lines = others.map(
    (person) =>
      `${whoOf(person.email)}: ${person.editing === memberId ? t.presence.editingHere : person.idle ? t.presence.idle : t.presence.viewingHere}`,
  );
  return (
    <span
      className={floating ? 'presence-dot presence-dot-floating' : 'presence-dot'}
      data-editing={editing ? '' : undefined}
      data-idle={others.every((person) => person.idle) ? '' : undefined}
      role="img"
      aria-label={lines.join(', ')}
      title={lines.join('\n')}
    >
      <span className="presence-dot-initials">{first.initials || '?'}</span>
      {others.length > 1 && <span className="presence-dot-more">+{others.length - 1}</span>}
      {editing && (
        <span className="presence-dot-pencil">
          <PencilIcon />
        </span>
      )}
    </span>
  );
}
