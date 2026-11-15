'use client';

import { useT } from './i18n';
import { CheckIcon, UserIcon } from './icons';
import { chipName } from './home/chipName';
import { useMe } from './Permissions';
import './sheet.css';

// The account above the "add yourself" form: who is signed in, with a way to their profile. The email is only shown
// here and never stored with the person, so nobody else in the tree sees it.
export default function SelfAccount({ onOpenProfile }: { onOpenProfile?: () => void }) {
  const t = useT();
  const me = useMe();
  if (!me) return null;
  // Named and abbreviated like the profile, so both show the same person.
  const name = chipName(me) ?? me.email;
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('');
  return (
    <section className="self-account" aria-label={t.self.eyebrow}>
      <span className="self-account-eyebrow">{t.self.eyebrow}</span>
      <div className="self-account-row">
        <span className="account-avatar self-account-avatar" aria-hidden="true">
          {initials}
        </span>
        <div className="self-account-text">
          <strong>{name}</strong>
          <span className="self-account-mail">{me.email}</span>
          <div className="account-chips">
            <span className={`account-chip${me.verified ? ' account-chip-on' : ''}`}>
              {me.verified && <CheckIcon />}
              {me.verified ? t.account.verifiedChip : t.account.unverified}
            </span>
          </div>
        </div>
        {onOpenProfile && (
          <button type="button" className="person-link-button self-account-profile" onClick={onOpenProfile}>
            <UserIcon />
            {t.self.openProfile}
          </button>
        )}
      </div>
      <p className="self-account-note">{t.self.emailNote}</p>
    </section>
  );
}
