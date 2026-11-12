'use client';

import { useEffect, useState } from 'react';
import { listMyLegalAcceptances, updateMe, type FamilySummary, type LegalAcceptance } from '../lib/api/generated/members';
import { chipName } from './home/chipName';
import { hasDevTools } from './home/signedIn';
import { useT } from './i18n';
import LegalAcceptances from './LegalAcceptances';
import { CheckIcon, ChevronIcon, CloseIcon, PencilIcon, TrashIcon, UserIcon, UsersIcon } from './icons';
import { useMe, useMeLoaded, useSetMe } from './Permissions';
import { useMyInvitations } from './myInvitations';
import Sheet from './Sheet';

const NAME_MAX_LENGTH = 100;

// The profile card from the burger menu, in the tree and on the landing page: who the person is (the name, editable), how
// they sign in, the developer-tools state, a way to their families, the documents they accepted, and deleting the account,
// which is announced but not built yet. Families and the invitations they sent live on the families board.
export default function ProfilePanel({
  families,
  feedbackEmail,
  onOpenFamilies,
  onClose,
}: {
  families: FamilySummary[] | null;
  // The operator's address; with it the note on deleting the account links there.
  feedbackEmail?: string;
  // Opens the families board; without it (no `family.create`) the profile has no way there.
  onOpenFamilies?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const me = useMe();
  const meLoaded = useMeLoaded();
  const setMe = useSetMe();
  const invitations = useMyInvitations(!!me && !!onOpenFamilies);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [acceptances, setAcceptances] = useState<LegalAcceptance[] | null>(null);
  const signedIn = !!me;
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    listMyLegalAcceptances()
      .then((response) => {
        if (current && response.status === 200) setAcceptances(response.data);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [signedIn]);
  const pending = invitations?.filter((invitation) => invitation.status === 'pending').length ?? 0;
  const received = families?.filter((family) => family.invitationPending).length ?? 0;

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

  const name = chipName(me);
  const initials = (name ?? '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('');

  return (
    <Sheet
      id="profile-panel"
      label={t.account.title}
      eyebrow={
        <>
          <UserIcon />
          {t.account.title}
        </>
      }
      closeLabel={t.account.close}
      onClose={onClose}
    >
      {me ? (
        <>
          <div className="account-hero">
            <span className="account-avatar" aria-hidden="true">
              {initials}
            </span>
            <div className="account-hero-text">
              {draft === null ? (
                <div className="account-name">
                  <h2>{name}</h2>
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
                      onKeyDown={(event) => event.key === 'Escape' && (event.stopPropagation(), event.nativeEvent.preventDefault(), setDraft(null))}
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
              <p className="account-mail">{me.email}</p>
              <div className="account-chips">
                <span className={`account-chip${me.verified ? ' account-chip-on' : ''}`}>
                  {me.verified && <CheckIcon />}
                  {me.verified ? t.account.verifiedChip : t.account.unverified}
                </span>
                {me.admin && <span className="account-chip account-chip-on">{t.account.roles.admin}</span>}
              </div>
            </div>
          </div>

          <div className="account-grid">
            <section>
              <h3 className="dashboard-subhead">{t.account.account}</h3>
              <dl className="profile-facts">
                <dt>{t.account.signInWith}</dt>
                <dd>{t.account.signInBy}</dd>
              </dl>
            </section>
            <section>
              <h3 className="dashboard-subhead">{t.account.devTools}</h3>
              {hasDevTools(me) ? (
                <p className="profile-dev profile-dev-active" role="status">
                  {t.account.devActive}
                </p>
              ) : (
                <p className="profile-dev person-muted">{t.account.devInactive}</p>
              )}
            </section>
          </div>

          {onOpenFamilies && (
            <button type="button" className="account-link" onClick={onOpenFamilies}>
              <UsersIcon />
              <span>
                <strong>{t.menu.families}</strong>
                <small>{t.account.familiesSummary(families?.length ?? 0, pending + received)}</small>
              </span>
              <ChevronIcon />
            </button>
          )}

          {acceptances && (
            <section>
              <h3 className="dashboard-subhead">{t.consent.list.title}</h3>
              {acceptances.length ? <LegalAcceptances acceptances={acceptances} className="profile-list" /> : <p className="person-muted">{t.consent.list.none}</p>}
            </section>
          )}

          <section className="account-danger">
            <h3 className="dashboard-subhead">{t.account.deleteTitle}</h3>
            <div className="account-danger-row">
              <button type="button" className="account-delete" disabled aria-describedby="account-delete-hint">
                <TrashIcon />
                {t.account.delete}
              </button>
              <span className="account-soon">{t.account.soon}</span>
            </div>
            <p className="sheet-hint" id="account-delete-hint">
              {t.account.deleteHint}
              {feedbackEmail && (
                <>
                  {' '}
                  <a href={`mailto:${feedbackEmail}?subject=ftree%20${encodeURIComponent(t.account.deleteTitle)}`}>{t.account.deleteAsk}</a>.
                </>
              )}
            </p>
          </section>
        </>
      ) : (
        <p className="person-muted">{meLoaded ? t.account.unavailable : t.account.loading}</p>
      )}
    </Sheet>
  );
}
