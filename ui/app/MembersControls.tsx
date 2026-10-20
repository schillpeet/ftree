'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  archiveFamily,
  createFamilyMember,
  deleteFamilyMember,
  deleteFamilyMemberPhoto,
  getFamilyMembers,
  getGetFamilyMemberPhotoUrl,
  updateFamilyMember,
  updateFamilyMemberRelatives,
  uploadFamilyMemberPhoto,
  type CreateMemberRequest,
  type Member,
  type Relatives,
} from '../lib/api/generated/members';
import { useLanguage, useT } from './i18n';
import { initialsOf, nameOf } from './names';
import { Avatar, PanelShell, PersonView } from './PersonPanel';
import RelativesFields from './RelativesFields';
import { ChevronLeftIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon, UsersIcon } from './icons';
import type { Focus } from './Scene';

type MemberForm = {
  firstName: string;
  lastName: string;
  birthName: string;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  note: string;
};

const EMPTY_FORM: MemberForm = {
  firstName: '',
  lastName: '',
  birthName: '',
  birthDate: '',
  birthPlace: '',
  deathDate: '',
  deathPlace: '',
  note: '',
};

const toForm = (member: Member): MemberForm => ({
  firstName: member.firstName,
  lastName: member.lastName,
  birthName: member.birthName ?? '',
  birthDate: member.birthDate ?? '',
  birthPlace: member.birthPlace ?? '',
  deathDate: member.deathDate ?? '',
  deathPlace: member.deathPlace ?? '',
  note: member.note ?? '',
});

export function formatDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

// An uploaded photo wins over the photo URL; its timestamp makes a new photo a new (uncached) URL.
export function photoSrc(member: Member, familyId: string | null) {
  if (member.photoUpdatedAt && familyId) {
    return `${getGetFamilyMemberPhotoUrl(familyId, member.id)}?v=${encodeURIComponent(member.photoUpdatedAt)}`;
  }
  return member.photoUrl ?? null;
}

// Scales the picked image down to at most 800 px on the longer edge and re-encodes it as JPEG,
// which keeps uploads well below the BFF's 2 MB limit.
async function toJpeg(file: File) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff'; // JPEG has no transparency
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), 'image/jpeg', 0.85),
  );
}

// Only shown when it differs from the current surname.
export const birthNameOf = (member: Member, t: ReturnType<typeof useT>) =>
  member.birthName && member.birthName !== member.lastName ? t.members.nee(member.birthName) : null;

export { initialsOf };

const yearOf = (value?: string | null) => value?.slice(0, 4) ?? '';

function MemberDetails({
  member,
  familyId,
  onSelect,
  onEdit,
  onDelete,
}: {
  member: Member;
  familyId: string | null;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const name = nameOf(member, t.members.unknown);
  const years = member.birthDate ? `${yearOf(member.birthDate)} – ${yearOf(member.deathDate)}`.trim() : yearOf(member.deathDate) && `† ${yearOf(member.deathDate)}`;
  const photo = photoSrc(member, familyId);
  const details = [birthNameOf(member, t), years].filter(Boolean).join(' · ');

  return (
    <li className="member-row">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="member-avatar" src={photo} alt="" />
      ) : (
        <span className="member-avatar" aria-hidden="true">
          {initialsOf(member)}
        </span>
      )}
      <div className="member-row-text">
        <button type="button" className="member-name" title={t.members.showInTree} onClick={onSelect}>
          {name}
        </button>
        {details && <span>{details}</span>}
      </div>
      <button type="button" className="icon-button" aria-label={t.members.editNamed(name)} onClick={onEdit}>
        <PencilIcon />
      </button>
      <button type="button" className="icon-button icon-button-danger" aria-label={t.members.deleteNamed(name)} onClick={onDelete}>
        <TrashIcon />
      </button>
    </li>
  );
}

export default function MembersControls({
  familyId,
  familyName,
  isDefaultFamily,
  members,
  setMembers,
  profile,
  isListOpen,
  onListOpenChange: setIsListOpen,
  onSelect,
  onShownChange,
  onFamiliesChanged,
  onBack,
}: {
  familyId: string | null;
  familyName: string | null;
  // Only the default family is archived: its people move to a new family and it starts empty.
  isDefaultFamily: boolean;
  members: Member[] | null;
  setMembers: Dispatch<SetStateAction<Member[] | null>>;
  // Member whose profile was requested from their scroll in the scene.
  profile: Focus;
  isListOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  // The person whose panel is open (viewed or edited), or null.
  onShownChange: (id: string | null) => void;
  onFamiliesChanged: () => void;
  // Returns to the family overview when the list was opened from the families panel.
  onBack?: () => void;
}) {
  const t = useT();
  const [language] = useLanguage();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Member | null>(null);
  // Picked image, uploaded once the member is saved.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Latest selection of the relatives fields, saved after the member.
  const relatives = useRef<{ value: Relatives; changed: boolean } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  // People shown before the current profile, so a trip through relatives can be walked back.
  const [trail, setTrail] = useState<string[]>([]);
  const [relativesChanged, setRelativesChanged] = useState(false);
  const [showBirthName, setShowBirthName] = useState(false);
  const [tab, setTab] = useState<'data' | 'relations'>('data');
  const [viewError, setViewError] = useState<string | null>(null);
  const listRef = useRef<HTMLElement>(null);

  async function reloadMembers() {
    if (!familyId) return;
    setIsLoading(true);
    setRequestError(null);
    try {
      const response = await getFamilyMembers(familyId);
      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error('Unexpected members response');
      }
      setMembers(response.data);
    } catch {
      setRequestError(t.members.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }

  const onLoadFailed = useEffectEvent(() => setRequestError(t.members.familyLoadFailed));

  // A family switch clears the previous tree before loading the selected family's members.
  useEffect(() => {
    if (!familyId) return;
    const currentFamilyId = familyId;
    let current = true;
    async function loadFamilyMembers() {
      try {
        const response = await getFamilyMembers(currentFamilyId);
        if (!current) return;
        if (response.status !== 200 || !Array.isArray(response.data)) {
          throw new Error('Unexpected members response');
        }
        setMembers(response.data);
      } catch {
        if (current) onLoadFailed();
      } finally {
        if (current) setIsLoading(false);
      }
    }
    void loadFamilyMembers();
    return () => {
      current = false;
    };
  }, [familyId, setMembers]);

  // Only a new profile request opens the profile (adjusted during render instead of in an effect).
  const [requestedProfile, setRequestedProfile] = useState(profile);
  if (profile !== requestedProfile) {
    setRequestedProfile(profile);
    if (profile) {
      setProfileId(profile.id);
      setTrail([]);
      setViewError(null);
    }
  }
  // Looked up on every render, so the profile follows edits and disappears with a deleted member.
  const profileMember = profileId ? members?.find((m) => m.id === profileId) : undefined;
  const shownId = (isFormOpen ? editing?.id : profileMember?.id) ?? null;
  useEffect(() => onShownChange(shownId), [shownId, onShownChange]);

  // The list is not modal: a press anywhere else or Escape closes it.
  useEffect(() => {
    if (!isListOpen) return;
    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Node;
      // The menu switches boards itself.
      if (!listRef.current?.contains(target) && !(target as Element).closest?.('.dashboard-menu')) setIsListOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsListOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isListOpen, setIsListOpen]);

  async function archive() {
    if (!familyId) return;
    const name = window.prompt(
      t.members.archiveName,
      t.members.archiveDefault(new Date().toLocaleDateString(language)),
    )?.trim();
    if (!name) return;
    setRequestError(null);
    try {
      const response = await archiveFamily(familyId, { name });
      if (response.status === 409) {
        setRequestError(t.familyExists(name));
        return;
      }
      if (response.status !== 201) throw new Error('Unexpected archive response');
      setMembers([]);
      onFamiliesChanged();
    } catch {
      setRequestError(t.members.archiveFailed);
    }
  }

  // Resolves whether the member is gone; onError shows a failure where it was requested.
  async function removeMember(member: Member, onError = setRequestError) {
    if (!familyId) return false;
    if (!window.confirm(t.members.confirmDelete(nameOf(member, t.members.unknown)))) return false;
    onError(null);
    try {
      const response = await deleteFamilyMember(familyId, member.id);
      if (response.status !== 204 && response.status !== 404) throw new Error('Unexpected delete response');
      setMembers((current) => current?.filter((m) => m.id !== member.id) ?? null);
      onFamiliesChanged();
      return true;
    } catch {
      onError(t.members.deleteFailed);
      return false;
    }
  }

  function openForm(member: Member | null = null) {
    if (!familyId) return;
    // Keep an unsaved create draft, but never carry an edited member's values into a new person.
    if (member) {
      setForm(toForm(member));
    } else if (editing) {
      setForm({ ...EMPTY_FORM });
    }
    setEditing(member);
    setPhotoFile(null);
    relatives.current = null;
    setRelativesChanged(false);
    setShowBirthName(!!member?.birthName);
    setTab('data');
    setFormKey((key) => key + 1);
    setIsListOpen(false);
    setFormError(null);
    setIsFormOpen(true);
  }

  const initialForm = editing && toForm(editing);
  const formChanged = !!initialForm && (Object.keys(initialForm) as (keyof MemberForm)[]).some((key) => form[key] !== initialForm[key]);
  // A new person can always be saved; an edited one only once something differs.
  const isDirty = !editing || formChanged || !!photoFile || relativesChanged;

  // Closes the form (Escape, ×, Discard): the create draft is kept anyway, edits are only discarded on confirmation,
  // and an edited person is shown again.
  function dismissForm() {
    if (isSaving) return;
    if (editing && isDirty && !window.confirm(t.discardChanges)) return;
    setIsFormOpen(false);
    if (editing) setProfileId(editing.id);
  }

  function showProfile(id: string) {
    setTrail((current) => (profileId ? [...current, profileId] : current));
    setViewError(null);
    setProfileId(id);
    onSelect(id);
  }

  function goBack() {
    const known = trail.filter((id) => members?.some((m) => m.id === id));
    const previous = known.at(-1);
    setTrail(known.slice(0, -1));
    if (!previous) return;
    setProfileId(previous);
    onSelect(previous);
  }

  function updateForm(field: keyof MemberForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!familyId) return;
    setIsSaving(true);
    setFormError(null);

    const request: CreateMemberRequest = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthName: form.birthName.trim() || null,
      birthDate: form.birthDate || null,
      birthPlace: form.birthPlace.trim() || null,
      deathDate: form.deathDate || null,
      deathPlace: form.deathPlace.trim() || null,
      note: form.note.trim() || null,
      // No longer editable, but kept for members that still have one.
      photoUrl: editing?.photoUrl ?? null,
    };

    try {
      let saved: Member;
      if (editing) {
        const response = await updateFamilyMember(familyId, editing.id, request);
        if (response.status !== 200) {
          setFormError(
            response.status === 404 ? t.members.gone : t.members.saveFailed,
          );
          return;
        }
        saved = response.data;
      } else {
        const response = await createFamilyMember(familyId, request);
        if (response.status !== 201) {
          setFormError(t.members.createFailed);
          return;
        }
        saved = response.data;
      }
      let photoFailed = false;
      if (photoFile) {
        try {
          const response = await uploadFamilyMemberPhoto(familyId, saved.id, await toJpeg(photoFile));
          if (response.status !== 204) throw new Error('Unexpected photo response');
          saved = { ...saved, photoUpdatedAt: new Date().toISOString() };
        } catch {
          photoFailed = true;
        }
      }
      // A new person with relatives counts as changed, an edited one only when the selection differs.
      const related = relatives.current;
      const relate = related && (editing ? related.changed : Object.values(related.value).some((ids) => ids?.length));
      let relativesError: string | null = null;
      if (relate) {
        try {
          const response = await updateFamilyMemberRelatives(familyId, saved.id, related.value);
          if (response.status === 400) relativesError = t.relatives.ownAncestor;
          else if (response.status !== 204) throw new Error('Unexpected relatives response');
        } catch {
          relativesError = t.relatives.saveFailed;
        }
      }
      const member = saved;
      setMembers((current) =>
        editing ? current?.map((m) => (m.id === member.id ? member : m)) ?? null : [member, ...(current ?? [])],
      );
      // Relatives change other members too, so the whole family is reloaded.
      if (relate && !relativesError) void reloadMembers();
      onFamiliesChanged();
      if (photoFailed || relativesError) {
        // The person exists now, so saving again must update them instead of creating a duplicate.
        // The relatives fields keep their selection, so a failed save can be retried.
        setEditing(member);
        setForm(toForm(member));
        setPhotoFile(null);
        setFormError(relativesError ?? t.members.photoFailed);
        return;
      }
      setIsFormOpen(false);
      setProfileId(member.id);
      setTrail([]);
      onSelect(member.id);
      setPhotoFile(null);
      if (!editing) setForm({ ...EMPTY_FORM });
    } catch {
      setFormError(t.members.unreachable);
    } finally {
      setIsSaving(false);
    }
  }

  async function removePhoto() {
    if (!familyId || !editing || !window.confirm(t.members.confirmRemovePhoto)) return;
    setFormError(null);
    try {
      const response = await deleteFamilyMemberPhoto(familyId, editing.id);
      if (response.status !== 204 && response.status !== 404) throw new Error('Unexpected photo response');
      const updated = { ...editing, photoUpdatedAt: null };
      setEditing(updated);
      setMembers((current) => current?.map((m) => (m.id === updated.id ? updated : m)) ?? null);
    } catch {
      setFormError(t.members.removePhotoFailed);
    }
  }

  const photoPreview = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  return (
    <div className="members-controls">
      {isListOpen && (
        <section className="glass dashboard-board members-panel" id="members-panel" aria-label={t.members.list} ref={listRef}>
          <header className="dashboard-board-header">
            {onBack && (
              <button type="button" aria-label={t.members.back} onClick={onBack}>
                <ChevronLeftIcon />
              </button>
            )}
            <UsersIcon />
            <h2>{familyName ?? t.members.title}</h2>
            <button type="button" aria-label={t.members.closeList} onClick={() => setIsListOpen(false)}>
              <CloseIcon />
            </button>
          </header>
          <div className="members-panel-body" aria-live="polite">
            <button type="button" className="member-add" disabled={!familyId} onClick={() => openForm()}>
              <PlusIcon />
              {t.members.add}
            </button>
            {familyId && isLoading && <p className="members-loading">{t.members.loading}</p>}
            {requestError && !isLoading && (
              <div className="members-error" role="alert">
                <p>{requestError}</p>
                <button type="button" onClick={() => void reloadMembers()}>{t.retry}</button>
              </div>
            )}
            {!familyId && (
              <p className="members-empty">{t.members.noFamily}</p>
            )}
            {!isLoading && !requestError && familyId && members?.length === 0 && (
              <p className="members-empty">{t.members.empty}</p>
            )}
            {!isLoading && !requestError && members && members.length > 0 && (
              <ul className="member-list">
                {members.map((member) => (
                  <MemberDetails
                    key={member.id}
                    member={member}
                    familyId={familyId}
                    onEdit={() => openForm(member)}
                    onSelect={() => {
                      setIsListOpen(false);
                      setProfileId(member.id);
                      setTrail([]);
                      setViewError(null);
                      onSelect(member.id);
                    }}
                    onDelete={() => void removeMember(member)}
                  />
                ))}
              </ul>
            )}
            {isDefaultFamily && !isLoading && !!members?.length && (
              <div className="members-archive">
                <button type="button" onClick={() => void archive()}>{t.members.archive}</button>
              </div>
            )}
          </div>
        </section>
      )}

      {isFormOpen && (
        <PanelShell
          // One panel per opened form, so focus starts in the first field again.
          key={`form-${formKey}`}
          label={editing ? t.members.edit : t.members.add}
          closeLabel={t.members.closeForm}
          onClose={dismissForm}
          onDelete={
            editing
              ? async () => {
                  if (await removeMember(editing, setFormError)) setIsFormOpen(false);
                }
              : undefined
          }
        >
          <form className="person-form" onSubmit={submitMember}>
            <div className="person-hero person-hero-edit">
              {/* Dropping an image on the avatar picks it like the file chooser does. */}
              <label
                className={`person-photo-drop${isDragging ? ' person-photo-drop-active' : ''}`}
                title={t.members.dropPhoto}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  const file = event.dataTransfer.files[0];
                  if (file?.type.startsWith('image/')) setPhotoFile(file);
                }}
              >
                <Avatar member={form} photo={photoPreview ?? (editing ? photoSrc(editing, familyId) : null)} large />
                <span>{t.members.changePhoto}</span>
                <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
              </label>
              <div className="person-name-fields">
                <input
                  autoFocus
                  autoComplete="given-name"
                  maxLength={100}
                  aria-label={t.members.firstName}
                  placeholder={t.members.firstName}
                  value={form.firstName}
                  onChange={(event) => updateForm('firstName', event.target.value)}
                />
                <input
                  autoComplete="family-name"
                  maxLength={100}
                  aria-label={t.members.lastName}
                  placeholder={t.members.lastName}
                  value={form.lastName}
                  onChange={(event) => updateForm('lastName', event.target.value)}
                />
                {editing?.photoUpdatedAt && !photoFile && (
                  <button type="button" className="person-link-button person-link-danger" disabled={isSaving} onClick={() => void removePhoto()}>
                    {t.members.removePhoto}
                  </button>
                )}
              </div>
            </div>
            <div className="person-tabs" role="tablist">
              {(['data', 'relations'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`person-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`person-tabpanel-${id}`}
                  onClick={() => setTab(id)}
                >
                  {id === 'data' ? t.members.tabData : t.members.tabRelations}
                </button>
              ))}
            </div>
            <div className="person-tabpanel" role="tabpanel" id="person-tabpanel-data" aria-labelledby="person-tab-data" hidden={tab !== 'data'}>
            {showBirthName ? (
              <label className="person-field">
                {t.members.birthName}
                <input maxLength={100} value={form.birthName} onChange={(event) => updateForm('birthName', event.target.value)} />
              </label>
            ) : (
              <button type="button" className="person-link-button" onClick={() => setShowBirthName(true)}>
                {t.members.addBirthName}
              </button>
            )}
            <div className="person-fields">
              <label className="person-field">
                {t.members.birthDate}
                <input type="date" value={form.birthDate} onChange={(event) => updateForm('birthDate', event.target.value)} />
              </label>
              <label className="person-field">
                {t.members.birthPlace}
                <input maxLength={200} value={form.birthPlace} onChange={(event) => updateForm('birthPlace', event.target.value)} />
              </label>
              <label className="person-field">
                {t.members.deathDate}
                <input type="date" value={form.deathDate} onChange={(event) => updateForm('deathDate', event.target.value)} />
              </label>
              <label className="person-field">
                {t.members.deathPlace}
                <input maxLength={200} value={form.deathPlace} onChange={(event) => updateForm('deathPlace', event.target.value)} />
              </label>
            </div>
            <label className="person-field">
              {t.members.note}
              <textarea maxLength={5000} value={form.note} onChange={(event) => updateForm('note', event.target.value)} />
            </label>
            </div>
            <div className="person-tabpanel" role="tabpanel" id="person-tabpanel-relations" aria-labelledby="person-tab-relations" hidden={tab !== 'relations'}>
            {members && (
              <RelativesFields
                // Remounted per opened form, so the selection starts from the stored relatives but
                // survives a failed save that turns a new person into an edited one.
                key={formKey}
                member={editing}
                members={members}
                photoOf={(m) => photoSrc(m, familyId)}
                onChange={(value, changed) => {
                  relatives.current = { value, changed };
                  setRelativesChanged(changed);
                }}
              />
            )}
            </div>
            {formError && <p className="person-error" role="alert">{formError}</p>}
            {isDirty && (
              <div className="person-footer">
                <button type="button" disabled={isSaving} onClick={dismissForm}>
                  {t.members.discard}
                </button>
                <button type="submit" className="person-primary" disabled={isSaving}>
                  {isSaving ? t.saving : t.members.save}
                </button>
              </div>
            )}
          </form>
        </PanelShell>
      )}

      {!isFormOpen && profileMember && members && (
        <PanelShell
          // Remounted per person, so focus (and so Escape) lands in the panel again.
          key={profileMember.id}
          label={t.profile.title}
          closeLabel={t.profile.close}
          autoFocusClose
          onClose={() => setProfileId(null)}
          onBack={trail.some((id) => members.some((m) => m.id === id)) ? goBack : undefined}
          onEdit={() => openForm(profileMember)}
          onDelete={() => void removeMember(profileMember, setViewError)}
        >
          <PersonView
            member={profileMember}
            photo={photoSrc(profileMember, familyId)}
            members={members}
            photoOf={(m) => photoSrc(m, familyId)}
            onShow={showProfile}
            error={viewError}
          />
        </PanelShell>
      )}
    </div>
  );
}
