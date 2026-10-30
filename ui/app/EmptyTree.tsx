'use client';

import { useT } from './i18n';
import { PlusIcon, UploadIcon, UserPlusIcon } from './icons';
import { useCan } from './Permissions';
import './treeRoute.css';

// Shown instead of a blank board when the caller has no tree yet or opens one without people; it only offers the
// existing flows their permissions allow (creating needs `family.create`, adding people `member.edit` in the open tree).
export default function EmptyTree({
  kind,
  onCreate,
  onImport,
  onAddPerson,
}: {
  kind: 'noTree' | 'noPeople';
  onCreate: () => void;
  // Opens the families board, where the GEDCOM import lives.
  onImport: () => void;
  onAddPerson: () => void;
}) {
  const t = useT();
  const canCreate = useCan('family.create');
  const canAdd = useCan('member.edit');
  const mayAct = kind === 'noTree' ? canCreate : canAdd;
  return (
    <section className="glass empty-tree" aria-label={t.emptyTree[kind]}>
      <h2>{t.emptyTree[kind]}</h2>
      <p>
        {kind === 'noTree'
          ? mayAct
            ? t.emptyTree.noTreeHint
            : t.emptyTree.noTreeShared
          : mayAct
            ? t.emptyTree.noPeopleHint
            : t.emptyTree.noPeopleShared}
      </p>
      {mayAct && (
        <div className="empty-tree-actions">
          {kind === 'noTree' ? (
            <>
              <button type="button" className="glass glass-button" onClick={onCreate}>
                <PlusIcon />
                {t.families.create}
              </button>
              <button type="button" className="glass glass-button" onClick={onImport}>
                <UploadIcon />
                {t.families.import}
              </button>
            </>
          ) : (
            <button type="button" className="glass glass-button" onClick={onAddPerson}>
              <UserPlusIcon />
              {t.emptyTree.addFirst}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
