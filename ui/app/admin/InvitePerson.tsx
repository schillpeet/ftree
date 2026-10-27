'use client';

import { useState, type FormEvent } from 'react';
import type { AdminFamily, TreeInvitation, TreeRole } from '../../lib/api/generated/members';
import { useLanguage, useT } from '../i18n';
import { copyText, share } from './accessActions';
import RolePicker from './RolePicker';

// "Person einladen": email, tree, and role; nothing is sent, the answer is a text to copy and send yourself.
export default function InvitePerson({ trees, onShared }: { trees: readonly AdminFamily[]; onShared: () => void }) {
  const t = useT();
  const [language] = useLanguage();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [role, setRole] = useState<TreeRole>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<TreeInvitation | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const chosen = familyId || trees[0]?.id || '';

  function close() {
    setOpen(false);
    setEmail('');
    setError(null);
    setInvitation(null);
    setCopied(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await share(chosen, email.trim(), role, language);
    setBusy(false);
    if (!result.ok) return setError(t.admin.problems[result.problem]);
    setInvitation(result.data);
    setCopied(null);
    onShared();
  }

  async function copy(text: string) {
    setCopied(await copyText(text));
  }

  if (!open) {
    return (
      <button type="button" className="glass glass-button" disabled={!trees.length} onClick={() => setOpen(true)}>
        {t.admin.invite.open}
      </button>
    );
  }

  return (
    <section className="glass admin-card" aria-labelledby="admin-invite">
      <h2 id="admin-invite">{t.admin.invite.title}</h2>
      {invitation ? (
        <div className="admin-invite-result">
          <p className="admin-muted">{t.admin.invite.done(invitation.access.displayName, invitation.link)}</p>
          <textarea className="admin-invite-text" readOnly rows={8} value={invitation.text} onFocus={(event) => event.target.select()} />
          <div className="admin-actions">
            {copied !== null && (
              <span className={copied ? 'admin-muted' : 'admin-error'} role="status">
                {copied ? t.admin.invite.copied : t.admin.invite.copyFailed}
              </span>
            )}
            <button type="button" className="family-card-button" onClick={() => void copy(invitation.text)}>
              {t.admin.invite.copy}
            </button>
            <button type="button" className="family-card-button" onClick={close}>
              {t.admin.invite.close}
            </button>
          </div>
        </div>
      ) : (
        <form className="admin-invite-form" onSubmit={(event) => void submit(event)}>
          <label>
            {t.admin.invite.email}
            <input
              className="admin-select"
              type="email"
              required
              autoFocus
              maxLength={320}
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            {t.admin.invite.tree}
            <select className="admin-select" value={chosen} onChange={(event) => setFamilyId(event.target.value)}>
              {trees.map((tree) => (
                <option key={tree.id} value={tree.id}>
                  {tree.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.admin.invite.role}
            <RolePicker value={role} onChange={setRole} label={t.admin.invite.role} />
          </label>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-actions">
            <button type="button" className="family-card-button" onClick={close}>
              {t.cancel}
            </button>
            <button type="submit" className="family-card-button" disabled={busy || !email.trim() || !chosen}>
              {t.admin.invite.submit}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
