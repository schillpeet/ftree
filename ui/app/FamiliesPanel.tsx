'use client';

import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { EyeIcon, EyeOffIcon, GripIcon, InfoIcon, MailIcon, PencilIcon, PlusIcon, UploadIcon, UsersIcon } from './icons';
import { importFamily, reorderFamilies, type FamilySummary } from '../lib/api/generated/members';
import RandomFamilyPanel from './RandomFamilyPanel';
import { useLanguage, useT } from './i18n';
import { useCan, useMe } from './Permissions';
import { MAX_OWNED_FAMILIES, atFamilyLimit } from './access';
import { useMyInvitations } from './myInvitations';
import { problemCode } from './problems';
import Sheet from './Sheet';

// The families board from the burger menu: the person's own families and those shared with them, each with their role and
// the current one marked, the invitations they sent, and new families (form, GEDCOM, random for developers) at the bottom.
// In the tree a family is opened, shown or hidden, and its card opened here; on the landing page (`place="home"`) choosing a
// family only makes it the current one, which "Go to the tree" then opens.
export default function FamiliesPanel({
  place = 'tree',
  families,
  setFamilies,
  activeFamilyId,
  isLoading,
  error,
  isOpen,
  onClose,
  onRetry,
  onSelect,
  onOpen,
  onToggleVisibility,
  onAdded,
  onCreate,
}: {
  place?: 'tree' | 'home';
  families: FamilySummary[] | null;
  setFamilies: Dispatch<SetStateAction<FamilySummary[] | null>>;
  activeFamilyId: string | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (familyId: string | null) => void;
  // Shows the family and opens its card, where it can be edited.
  onOpen: (familyId: string) => void;
  onToggleVisibility: (familyId: string) => void;
  // A family was imported or generated here.
  onAdded: (family: FamilySummary) => void;
  // Opens the family card with an empty form for a new family.
  onCreate: () => void;
}) {
  const t = useT();
  // Admins and people who may create trees import and generate families; only admins reorder them.
  const canImport = useCan('family.create');
  const canGenerate = useCan('dev.tools');
  const manage = useCan('family.manage');
  // At the limit the BFF would refuse a new family, so creating and importing are off and the reason shows right below.
  const atLimit = atFamilyLimit(useMe(), families);
  const [isImporting, setIsImporting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [language] = useLanguage();
  const invitations = useMyInvitations(isOpen);

  // Always creates a new family; the BFF reads the file and refuses taken names.
  async function importGedcom(file: File) {
    const name = window.prompt(
      t.families.importName,
      file.name.replace(/\.ged$/i, ''),
    )?.trim();
    if (!name) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const response = await importFamily({ name, gedcom: await file.text() });
      if (response.status !== 201) {
        const code = problemCode(response.data);
        if (code === 'NAME_TAKEN') return setImportError(t.familyExists(name));
        if (code === 'TREE_LIMIT_REACHED') return setImportError(t.treeLimit);
        if (code === 'MEMBER_LIMIT_REACHED') return setImportError(t.memberLimit);
        if (code === 'INVALID_REQUEST' || code === 'VALIDATION_FAILED') return setImportError(t.families.importInvalid);
        throw new Error('Unexpected import response');
      }
      onAdded(response.data);
    } catch {
      setImportError(t.families.importFailed);
    } finally {
      setIsImporting(false);
    }
  }

  // Optimistic: the list shows the dropped order at once and goes back if the BFF refuses it.
  async function moveFamily(id: string, targetId: string) {
    const before = families;
    const moved = before?.find((family) => family.id === id);
    if (!before || !moved || id === targetId) return;
    const next = before.filter((family) => family.id !== id);
    next.splice(before.findIndex((family) => family.id === targetId), 0, moved);
    setFamilies(next);
    setReorderError(null);
    try {
      const response = await reorderFamilies({ familyIds: next.map((family) => family.id) });
      if (response.status !== 204) throw new Error(`HTTP ${response.status}`);
    } catch {
      setFamilies(before);
      setReorderError(t.families.reorderFailed);
    }
  }

  if (!isOpen) return null;
  const draggedIndex = families?.findIndex((family) => family.id === draggedId) ?? -1;
  const own = families?.filter((family) => family.role === 'owner') ?? [];
  const shared = families?.filter((family) => family.role === 'editor' || family.role === 'visitor') ?? [];
  // Admins see every family in that role, neither own nor shared with them.
  const others = families?.filter((family) => family.role === 'admin') ?? [];
  const pending = invitations?.filter((invitation) => invitation.status === 'pending').length ?? 0;

  const row = (family: FamilySummary) => {
    const index = families?.indexOf(family) ?? -1;
    const current = family.id === activeFamilyId;
    return (
      <li
        className="family-row"
        key={family.id}
        aria-current={current || undefined}
        title={manage ? t.families.dragHint : undefined}
        draggable={manage}
        data-drop={
          draggedIndex >= 0 && dropTargetId === family.id && draggedId !== family.id
            ? draggedIndex < index ? 'after' : 'before'
            : undefined
        }
        onDragStart={(event) => {
          if (!manage) return;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', family.id);
          setDraggedId(family.id);
        }}
        onDragOver={(event) => {
          if (!draggedId) return;
          event.preventDefault();
          setDropTargetId(family.id);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (draggedId) void moveFamily(draggedId, family.id);
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setDropTargetId(null);
        }}
      >
        <span className="family-row-grip" aria-hidden="true">
          {manage && <GripIcon />}
        </span>
        <button
          type="button"
          className="family-row-select"
          aria-pressed={current}
          title={place === 'home' ? t.families.makeCurrent(family.name) : undefined}
          onClick={() => onSelect(family.id)}
        >
          <strong>
            {family.name}
            {current && <span className="family-current">{t.families.current}</span>}
          </strong>
          <span>{t.families.summary(family.memberCount, family.generationCount)}</span>
          {family.testSettings && (
            <span>
              {t.families.settings(
                family.testSettings.totalUsers,
                family.testSettings.generationCount,
                family.testSettings.minChildren,
                family.testSettings.maxChildren,
              )}
            </span>
          )}
        </button>
        <span className={`account-chip${family.invitationPending ? ' account-chip-on' : ''}`}>
          {family.invitationPending ? t.families.invitationOpen : t.account.roles[family.role]}
        </span>
        {place === 'tree' ? (
          <button
            className="person-icon-button"
            type="button"
            aria-label={current ? t.families.hide(family.name) : t.families.show(family.name)}
            title={current ? t.families.hide(family.name) : t.families.show(family.name)}
            aria-pressed={current}
            onClick={() => onToggleVisibility(family.id)}
          >
            {current ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        ) : (
          <span />
        )}
        {place === 'tree' ? (
          <button
            className="person-icon-button"
            type="button"
            aria-label={t.families.openCard(family.name)}
            title={t.families.openCard(family.name)}
            onClick={() => onOpen(family.id)}
          >
            <PencilIcon />
          </button>
        ) : (
          <span />
        )}
      </li>
    );
  };

  const footer = canImport ? (
    <>
      <button
        type="button"
        className="sheet-button sheet-button-primary"
        disabled={isImporting || atLimit}
        aria-describedby={atLimit ? 'family-limit' : undefined}
        onClick={onCreate}
      >
        <PlusIcon />
        {t.families.create}
      </button>
      <button
        type="button"
        className="sheet-button"
        disabled={isImporting || atLimit}
        aria-describedby={atLimit ? 'family-limit' : undefined}
        onClick={() => fileRef.current?.click()}
      >
        <UploadIcon />
        {isImporting ? t.families.importing : t.families.import}
      </button>
      <button
        type="button"
        className="person-icon-button"
        aria-label={t.families.gedcomInfo}
        title={t.families.gedcomInfo}
        aria-expanded={infoOpen}
        aria-controls="gedcom-info"
        onClick={() => setInfoOpen((open) => !open)}
      >
        <InfoIcon />
      </button>
      {atLimit && (
        <p className="family-limit" id="family-limit" role="status">
          {t.treeLimit}
        </p>
      )}
      {infoOpen && (
        <div className="gedcom-info" id="gedcom-info">
          <p>{t.families.gedcomWhat}</p>
          <p>{t.families.gedcomImports}</p>
          <p>{t.families.gedcomCare(MAX_OWNED_FAMILIES)}</p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".ged"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importGedcom(file);
        }}
      />
    </>
  ) : undefined;

  return (
    <Sheet
      id="families-panel"
      label={t.families.title}
      eyebrow={
        <>
          <UsersIcon />
          {t.families.title}
        </>
      }
      closeLabel={t.families.close}
      // An import in progress keeps the board, so its result has somewhere to show.
      onClose={() => !isImporting && onClose()}
      footer={footer}
    >
      {isLoading && <p className="members-loading">{t.families.loading}</p>}
      {error && (
        <div className="members-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            {t.retry}
          </button>
        </div>
      )}
      {!isLoading && !error && families?.length === 0 && <p className="members-empty">{t.families.empty}</p>}
      {importError && (
        <p className="member-form-error" role="alert">
          {importError}
        </p>
      )}
      {reorderError && (
        <p className="member-form-error" role="alert">
          {reorderError}
        </p>
      )}
      {own.length > 0 && (
        <section>
          <div className="family-group-head">
            <h3 className="dashboard-subhead">{t.families.own}</h3>
            {canImport && <span className="family-count">{t.families.ownCount(own.length, MAX_OWNED_FAMILIES)}</span>}
          </div>
          <ul className="family-rows">{own.map(row)}</ul>
        </section>
      )}
      {shared.length > 0 && (
        <section>
          <div className="family-group-head">
            <h3 className="dashboard-subhead">{t.families.shared}</h3>
          </div>
          <ul className="family-rows">{shared.map(row)}</ul>
        </section>
      )}
      {others.length > 0 && (
        <section>
          <div className="family-group-head">
            <h3 className="dashboard-subhead">{t.families.all}</h3>
          </div>
          <ul className="family-rows">{others.map(row)}</ul>
        </section>
      )}
      {!!invitations?.length && (
        <section>
          <div className="family-group-head">
            <h3 className="dashboard-subhead">
              {t.account.invitations}
              <span className="profile-count" aria-label={String(pending)}>
                {pending}
              </span>
            </h3>
          </div>
          <ul className="family-rows">
            {invitations.map((invitation) => (
              <li className="family-row family-invite" key={`${invitation.familyId}-${invitation.email}`} data-status={invitation.status}>
                <span className="family-invite-icon">
                  <MailIcon />
                </span>
                <span>
                  <strong>
                    {invitation.email} · {invitation.familyName}
                  </strong>
                  <small>
                    {t.account.invitedAs(t.account.roles[invitation.role], new Date(invitation.invitedAt).toLocaleDateString(language))}
                  </small>
                </span>
                <span className={`account-chip${invitation.status === 'pending' ? ' account-chip-on' : ''}`}>
                  {t.account.invitationStatus[invitation.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {canImport && canGenerate && <RandomFamilyPanel families={families} onCreated={onAdded} />}
    </Sheet>
  );
}
