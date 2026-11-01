'use client';

import { useState } from 'react';
import { updateMe, type FamilySummary } from '../lib/api/generated/members';
import { chipName } from './home/chipName';
import { hasDevTools } from './home/signedIn';
import { useLanguage, useT } from './i18n';
import { CheckIcon, CloseIcon, PencilIcon, UserIcon } from './icons';
import { useMe, useMeLoaded, useSetMe } from './Permissions';
import { useMyInvitations } from './myInvitations';

const NAME_MAX_LENGTH = 100;

// The small profile board next to the burger menu: the name (editable), private facts, the person's families with their
// role, the developer-tools state, and the invitations they received.
export default function ProfilePanel({
  families,
  activeFamily,
  onClose,
}: {
  families: FamilySummary[] | null;
  activeFamily: FamilySummary | undefined;
  onClose: () => void;
}) {
  const t = useT();
  const [language] = useLanguage();
  const me = useMe();
  const meLoaded = useMeLoaded();
  const setMe = useSetMe();
  const invitations = useMyInvitations(!!me);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = invitations?.filter((invitation) => invitation.status === 'pending').length ?? 0;

  async function saveName() {
    if (draft === null) return;
    setSaving(true);
    setFailed(false);
    try {
      const response = await updateMe({ displayName: draft.trim() });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      setMe(response.data);
      setDraft(null);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass dashboard-board" id="profile-panel" aria-label={t.account.title}>
      <header className="dashboard-board-header">
        <UserIcon />
        <h2>{t.account.title}</h2>
        <button type="button" aria-label={t.account.close} onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="profile-panel-body">
        {me ? (
          <>
            <h3 className="dashboard-subhead">{t.account.name}</h3>
            {draft === null ? (
              <div className="profile-name">
                <strong>{chipName(me)}</strong>
                <button type="button" className="profile-icon-button" aria-label={t.account.nameEdit} title={t.account.nameEdit} onClick={() => setDraft(me.customName ?? '')}>
                  <PencilIcon />
                </button>
              </div>
            ) : (
              <form
                className="profile-name-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveName();
                }}
              >
                <div className="profile-name">
                  <input
                    value={draft}
                    maxLength={NAME_MAX_LENGTH}
                    placeholder={me.email.split('@')[0]}
                    aria-label={t.account.nameInput}
                    autoFocus
                    disabled={saving}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => event.key === 'Escape' && (event.stopPropagation(), setDraft(null))}
                  />
                  <button type="submit" className="profile-icon-button" aria-label={t.account.nameSave} title={t.account.nameSave} disabled={saving}>
                    <CheckIcon />
                  </button>
                  <button type="button" className="profile-icon-button" aria-label={t.account.nameCancel} title={t.account.nameCancel} disabled={saving} onClick={() => setDraft(null)}>
                    <CloseIcon />
                  </button>
                </div>
                <p className="profile-hint">{t.account.nameHint}</p>
                {failed && <p className="member-form-error" role="alert">{t.account.nameFailed}</p>}
              </form>
            )}

            <h3 className="dashboard-subhead">{t.account.private}</h3>
            <dl className="profile-facts">
              <dt>{t.account.email}</dt>
              <dd>{me.email}</dd>
              <dt>{t.account.role}</dt>
              <dd>{me.admin ? t.account.roles.admin : activeFamily ? t.account.roles[activeFamily.role] : t.account.noFamily}</dd>
              <dt>{t.account.verification}</dt>
              <dd>{me.verified ? t.account.verified : t.account.unverified}</dd>
            </dl>

            <h3 className="dashboard-subhead">{t.account.devTools}</h3>
            {hasDevTools(me) ? (
              <p className="profile-dev profile-dev-active" role="status">
                {t.account.devActive}
              </p>
            ) : (
              <p className="profile-dev person-muted">{t.account.devInactive}</p>
            )}

            <h3 className="dashboard-subhead">{t.account.myFamilies}</h3>
            {families?.length ? (
              <ul className="profile-list">
                {families.map((family) => (
                  <li key={family.id}>
                    <span>{family.name}</span>
                    <span className="profile-tag">{t.account.roles[family.role]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="person-muted">{t.account.noFamilies}</p>
            )}

            {invitations && (
              <>
                <h3 className="dashboard-subhead">
                  {t.account.invitations}
                  <span className="profile-count" aria-label={String(pending)}>{pending}</span>
                </h3>
                {invitations.length ? (
                  <ul className="profile-list">
                    {invitations.map((invitation) => (
                      <li key={`${invitation.familyId}-${invitation.email}`} data-status={invitation.status}>
                        <span className="profile-invite">
                          <span>{invitation.familyName}</span>
                          <small>
                            {t.account.invitedAs(
                              t.account.roles[invitation.role],
                              new Date(invitation.invitedAt).toLocaleDateString(language),
                            )}
                          </small>
                        </span>
                        <span className="profile-tag" data-status={invitation.status}>
                          {t.account.invitationStatus[invitation.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="person-muted">{t.account.noInvitations}</p>
                )}
              </>
            )}
          </>
        ) : (
          <p className="person-muted">{meLoaded ? t.account.unavailable : t.account.loading}</p>
        )}
      </div>
    </section>
  );
}
