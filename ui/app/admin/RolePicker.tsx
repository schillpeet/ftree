'use client';

import type { TreeRole } from '../../lib/api/generated/members';
import { useT } from '../i18n';

export const TREE_ROLES: readonly TreeRole[] = ['owner', 'editor', 'visitor'];

// A menu of the three tree roles with their readable names.
export default function RolePicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: TreeRole;
  onChange: (role: TreeRole) => void;
  disabled?: boolean;
  label: string;
}) {
  const t = useT();
  return (
    <select
      className="admin-select admin-role"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as TreeRole)}
    >
      {TREE_ROLES.map((role) => (
        <option key={role} value={role}>
          {t.account.roles[role]}
        </option>
      ))}
    </select>
  );
}
