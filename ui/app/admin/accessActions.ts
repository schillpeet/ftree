import { type TreeInvitation, type TreeRole, revokeTreeAccess, shareTree } from '../../lib/api/generated/members';
import type { Language } from '../i18n';
import { problemCode } from '../problems';
import { accessProblem, type AccessProblem } from './adminData';

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

export async function revoke(familyId: string, userId: string): Promise<AccessResult<null>> {
  try {
    const response = await revokeTreeAccess(familyId, userId);
    if (response.status === 204) return { ok: true, data: null };
    return { ok: false, problem: accessProblem(problemCode(response.data)) };
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
