'use client';

import { useT } from './i18n';

// Above a tree opened on the administration's host: the admin acts there with every right, and the BFF logs opening a
// tree they hold no role in.
export default function AdminViewBanner() {
  const t = useT();
  return (
    <p className="glass admin-view-banner" role="note">
      {t.admin.viewBanner}
    </p>
  );
}
