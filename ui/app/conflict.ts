import { problemCode } from './problems.ts';

// A member update is rejected with 409 and code EDIT_CONFLICT when someone else saved the person since the form was
// opened. Other 409s (for example a taken name) and every other status are ordinary errors.
export function isEditConflict(response: { status: number; data?: unknown }): boolean {
  return response.status === 409 && problemCode(response.data) === 'EDIT_CONFLICT';
}

// The spec has no force flag: an update without a version overwrites whatever is stored.
export function withVersion<T extends object>(request: T, version: number, overwrite: boolean): T & { version?: number } {
  return overwrite ? request : { ...request, version };
}
