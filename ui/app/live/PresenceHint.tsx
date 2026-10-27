'use client';

import { useT } from '../i18n';
import { EyeIcon, PencilIcon } from '../icons';
import { whoOf } from './liveEvents';
import { useOthersAt } from './people';
import { hintAt } from './presence';
import './presence.css';

// The line in a person's panel that says who else edits or views them right now.
export default function PresenceHint({ memberId }: { memberId: string }) {
  const t = useT();
  const hint = hintAt(useOthersAt(memberId), memberId);
  if (!hint) return null;
  const name = whoOf(hint.email);
  const who = hint.more > 0 ? t.presence.andMore(name, hint.more) : name;
  return (
    <p className="presence-hint" data-editing={hint.kind === 'editing' ? '' : undefined} role="status">
      {hint.kind === 'editing' ? <PencilIcon /> : <EyeIcon />}
      <span>{hint.kind === 'editing' ? t.presence.isEditing(who) : t.presence.isViewing(who)}</span>
    </p>
  );
}
