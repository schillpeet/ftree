import {
  type SetupInvitation,
  type TreeInvitation,
  type TreeRole,
  deleteAdminUser,
  inviteWithoutTree,
  revokeAdminUserSessions,
  revokeTreeAccess,
  shareTree,
  transferTreeOwnership,
  updateAdminUser,
  type UpdateAdminUserRequest,
} from '../../lib/api/generated/members';
import type { Language } from '../i18n';
import { problemCode } from '../problems';
import { accessProblem, deleteProblem, type AccessProblem } from './adminData';

export type AccessResult<T> = { ok: true; data: T } | { ok: false; problem: AccessProblem };

// Gives the person the role in the tree (a new invitation, or a changed role) and returns the invitation text in the
// page's language. Sharing again with the same role changes nothing, so it also fetches the text of a pending invitation.
export async function share(familyId: string, email: string, role: TreeRole, language: Language): Promise<AccessResult<TreeInvitation>> {
  try {
    const response = await shareTree(familyId, { email, role }, { headers: { 'Accept-Language': language } });
    if (response.status === 200) return { ok: true, data: response.data as TreeInvitation };
    return { ok: false, problem: accessProblem(problemCode(response.data)) };
  } catch {
    return { ok: false, problem: 'failed' };
  }
}

// Invites the person to set up their own tree, so after signing in they start with an empty setup; the role is the one
// they have in trees they are invited to later.
export async function inviteToSetup(email: string, role: TreeRole, language: Language): Promise<AccessResult<SetupInvitation>> {
  try {
    const response = await inviteWithoutTree({ email, role }, { headers: { 'Accept-Language': language } });
    if (response.status === 200) return { ok: true, data: response.data as SetupInvitation };
    return { ok: false, problem: accessProblem(problemCode(response.data)) };
  } catch {
    return { ok: false, problem: 'failed' };
  }
}

export async function revoke(familyId: string, userId: string): Promise<AccessResult<null>> {
  try {
    const response = await revokeTreeAccess(familyId, userId);
    if (response.status === 204) return { ok: true, data: null };
    return { ok: false, problem: accessProblem(problemCode(response.data)) };
  } catch {
    return { ok: false, problem: 'failed' };
  }
}

// Hands the tree to the person, who must have a role in it; everyone who owned it before becomes an editor.
export async function transfer(familyId: string, userId: string): Promise<AccessResult<null>> {
  try {
    const response = await transferTreeOwnership(familyId, { userId });
    if (response.status === 204) return { ok: true, data: null };
    return { ok: false, problem: accessProblem(problemCode(response.data)) };
  } catch {
    return { ok: false, problem: 'failed' };
  }
}

// Changes the person's display name or developer tools; the BFF answers `SEATS_EXHAUSTED` when they need a seat that is not left.
export async function updateUser(userId: string, body: UpdateAdminUserRequest): Promise<AccessResult<null>> {
  try {
    const response = await updateAdminUser(userId, body);
    if (response.status === 200) return { ok: true, data: null };
    return { ok: false, problem: accessProblem(problemCode(response.data)) };
  } catch {
    return { ok: false, problem: 'failed' };
  }
}

// Signs the person out of Cloudflare Access; their rights stay.
export async function endSessions(userId: string): Promise<AccessResult<null>> {
  try {
    const response = await revokeAdminUserSessions(userId);
    if (response.status === 204) return { ok: true, data: null };
    return { ok: false, problem: accessProblem(problemCode(response.data)) };
  } catch {
    return { ok: false, problem: 'failed' };
  }
}

// Deletes the person; the BFF refuses while they are the only owner of a tree.
export async function deleteUser(userId: string): Promise<AccessResult<null>> {
  try {
    const response = await deleteAdminUser(userId);
    if (response.status === 204) return { ok: true, data: null };
    return { ok: false, problem: deleteProblem(problemCode(response.data)) };
  } catch {
    return { ok: false, problem: 'failed' };
  }
}

// Puts the text on the clipboard; false when the browser refuses (no permission, or an insecure page).
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
