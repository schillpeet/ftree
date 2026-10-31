import { Suspense } from 'react';
import AuditTab from '../AuditTab';

// The log reads its starting filters from `?person=` and `?tree=`, which are only known in the browser.
export default function AdminAuditPage() {
  return (
    <Suspense>
      <AuditTab />
    </Suspense>
  );
}
