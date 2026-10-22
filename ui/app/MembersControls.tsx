'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
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
  type FamilySummary,
  type Member,
  type Relatives,
} from '../lib/api/generated/members';
import { useLanguage, useT } from './i18n';
import { initialsOf, nameOf } from './names';
import { dateProblem } from './partnerships';
import { PanelShell, PersonView, usePanelPin } from './PersonPanel';
import { CENTRE, type Offset } from './panelPosition';
import RelativesFields, { type Relation } from './RelativesFields';
import { EMPTY_FORM, MemberHero, MemberLifeFields, NewMemberPanel, toForm, toJpeg, toRequest, usePhotoPreview, type MemberForm } from './MemberFields';
import type { Focus } from './Scene';
import FamilyCard, { type FamilyCardMode } from './FamilyCard';

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

// Only shown when it differs from the current surname.
export const birthNameOf = (member: Member, t: ReturnType<typeof useT>) =>
  member.birthName && member.birthName !== member.lastName ? t.members.nee(member.birthName) : null;

export { initialsOf };


export default function MembersControls({
  familyId,
  family,
  familyCard,
  onFamilyCardChange,
  onFamilyCreated,
  isDefaultFamily,
  members,
  setMembers,
  profile,
  addRequest,
  onSelect,
  onShownChange,
  onFamiliesChanged,
}: {
  familyId: string | null;
  family: FamilySummary | undefined;
  // The family card of this family, open to view or edit, or null.
  familyCard: FamilyCardMode | null;
  onFamilyCardChange: (mode: FamilyCardMode | null) => void;
  onFamilyCreated: (family: FamilySummary) => void;
  // Only the default family is archived: its people move to a new family and it starts empty.
  isDefaultFamily: boolean;
  members: Member[] | null;
  setMembers: Dispatch<SetStateAction<Member[] | null>>;
  // Member whose profile was requested from their scroll in the scene.
  profile: Focus;
  // A new object per "Add member" in the menu, which opens the form for a new person.
  addRequest: object | null;
  onSelect: (id: string) => void;
  // The person whose panel is open (viewed or edited), or null.
  onShownChange: (id: string | null) => void;
  onFamiliesChanged: () => void;
}) {
  const t = useT();
  const [language] = useLanguage();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Member | null>(null);
  // Picked image, uploaded once the member is saved.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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
  // The person being created from the relatives search, and how to assign them once saved.
  // shift is how far the form panel moved over to make room for its panel, undone when that closes.
  const [newRelative, setNewRelative] = useState<{
    name: string;
    relation: Relation;
    onCreated: (id: string) => void;
    key: number;
    shift: number;
  } | null>(null);

  async function reloadMembers() {
    if (!familyId) return;
    setRequestError(null);
    try {
      const response = await getFamilyMembers(familyId);
      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error('Unexpected members response');
      }
      setMembers(response.data);
    } catch {
      setRequestError(t.members.loadFailed);
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
      }
    }
    void loadFamilyMembers();
    return () => {
      current = false;
    };
  }, [familyId, setMembers]);

  const onAddRequest = useEffectEvent(() => openForm());
  useEffect(() => {
    if (addRequest) onAddRequest();
  }, [addRequest]);

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

  // One position for the profile and its edit form, so switching between them keeps the panel in place.
  // A pinned position is remembered and cannot be dragged; otherwise the next panel opens centred again.
  const [pin, setPin] = usePanelPin();
  const [moved, setMoved] = useState<Offset>(CENTRE);
  const isPanelOpen = isFormOpen || !!profileMember;
  if (!isPanelOpen && moved !== CENTRE) setMoved(CENTRE);
  const panelPosition = {
    offset: pin ?? moved,
    onMove: (next: Offset) => (pin ? setPin(next) : setMoved(next)),
    pinned: !!pin,
    onPinnedChange: (pinned: boolean) => {
      if (pinned) {
        setPin(moved);
      } else {
        setMoved(pin ?? CENTRE);
        setPin(null);
      }
    },
  };

  // The "… hinzufügen" button of the relation a new person is created for.
  const linkFrom = useCallback(() => document.querySelector('.person-panel-origin [data-linked] .person-add'), []);

  function closeNewRelative() {
    const shift = newRelative?.shift ?? 0;
    if (shift && !pin) setMoved((current) => ({ x: current.x - shift, y: current.y }));
    setNewRelative(null);
  }
  useEffect(() => onShownChange(shownId), [shownId, onShownChange]);

  async function archive(onError: (message: string | null) => void = setRequestError) {
    if (!familyId) return;
    const name = window.prompt(
      t.members.archiveName,
      t.members.archiveDefault(new Date().toLocaleDateString(language)),
    )?.trim();
    if (!name) return;
    onError(null);
    try {
      const response = await archiveFamily(familyId, { name });
      if (response.status === 409) {
        onError(t.familyExists(name));
        return;
      }
      if (response.status !== 201) throw new Error('Unexpected archive response');
      setMembers([]);
      onFamiliesChanged();
    } catch {
      onError(t.members.archiveFailed);
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
    setFormError(null);
    closeNewRelative();
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
    closeNewRelative();
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
    // Checked before anything is saved, so a wrong date never leaves the person half saved.
    const problem = relatives.current?.value.partnerships?.map((p) => dateProblem(p)).find(Boolean);
    if (problem) {
      setFormError(t.relatives[problem]);
      return;
    }
    setIsSaving(true);
    setFormError(null);

    // The photo URL is no longer editable, but kept for members that still have one.
    const request = toRequest(form, editing?.photoUrl ?? null);

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

  const photoPreview = usePhotoPreview(photoFile);

  return (
    <div className="members-controls">
      {isFormOpen && (
        <PanelShell
          // One panel per opened form, so focus starts in the first field again.
          key={`form-${formKey}`}
          label={editing ? t.members.edit : t.members.add}
          closeLabel={t.members.closeForm}
          onClose={dismissForm}
          {...panelPosition}
          className={`person-panel-form${newRelative ? ' person-panel-origin' : ''}`}
          onDelete={
            editing
              ? async () => {
                  if (await removeMember(editing, setFormError)) setIsFormOpen(false);
                }
              : undefined
          }
        >
          <form className="person-form" onSubmit={submitMember}>
            <MemberHero
              form={form}
              onChange={updateForm}
              photo={photoPreview ?? (editing ? photoSrc(editing, familyId) : null)}
              onPhoto={setPhotoFile}
              showBirthName={showBirthName}
              onShowBirthName={() => setShowBirthName(true)}
            >
              {editing?.photoUpdatedAt && !photoFile && (
                <button type="button" className="person-link-button person-link-danger" disabled={isSaving} onClick={() => void removePhoto()}>
                  {t.members.removePhoto}
                </button>
              )}
            </MemberHero>
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
            <MemberLifeFields form={form} onChange={updateForm} />
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
                onCreate={
                  familyId
                    ? (name, relation, onCreated) => {
                        closeNewRelative();
                        setNewRelative((current) => ({ name, relation, onCreated, key: (current?.key ?? 0) + 1, shift: 0 }));
                      }
                    : undefined
                }
                linked={newRelative?.relation}
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

      {isFormOpen && newRelative && familyId && (
        <NewMemberPanel
          // One panel per request, so a second search starts with its own name.
          key={newRelative.key}
          familyId={familyId}
          name={newRelative.name}
          title={t.relatives.newTitle(newRelative.relation, nameOf(form, t.members.unknown))}
          anchor={() => document.querySelector('.person-panel-form')}
          anchorPinned={!!pin}
          onShiftAnchor={(dx) => {
            setMoved((current) => ({ x: current.x + dx, y: current.y }));
            setNewRelative((current) => current && { ...current, shift: current.shift + dx });
          }}
          linkFrom={linkFrom}
          onClose={closeNewRelative}
          onCreated={(member, photoFailed) => {
            setMembers((current) => [member, ...(current ?? [])]);
            onFamiliesChanged();
            newRelative.onCreated(member.id);
            closeNewRelative();
            if (photoFailed) setFormError(t.members.photoFailed);
          }}
        />
      )}

      {/* Before the person panel, so a person opened from the card shows on top of it. */}
      {familyCard && family && (
        <FamilyCard
          family={family}
          members={members}
          isDefault={isDefaultFamily}
          mode={familyCard}
          onModeChange={onFamilyCardChange}
          onClose={() => onFamilyCardChange(null)}
          photoOf={(m) => photoSrc(m, familyId)}
          onOpenMember={(id) => {
            setProfileId(id);
            setTrail([]);
            setViewError(null);
            onSelect(id);
          }}
          onChanged={onFamiliesChanged}
          onCreated={onFamilyCreated}
          onArchive={archive}
          loadError={requestError}
          onRetry={() => void reloadMembers()}
        />
      )}

      {!isFormOpen && profileMember && members && (
        <PanelShell
          // Remounted per person, so focus (and so Escape) lands in the panel again.
          key={profileMember.id}
          label={t.profile.title}
          hideLabel
          closeLabel={t.profile.close}
          autoFocusClose
          closeOnOutsideClick
          onClose={() => setProfileId(null)}
          {...panelPosition}
          onBack={trail.some((id) => members.some((m) => m.id === id)) ? goBack : undefined}
          onEdit={() => openForm(profileMember)}
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
