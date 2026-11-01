import type { Metadata } from 'next';
import Landing from './Landing';

export const metadata: Metadata = {
  title: 'ftree · Eure Familie. Ein Baum, der mitwächst.',
};

// The public landing page: outside the `(tree)` group, so it loads no `/me` and needs no sign-in (Cloudflare Access lets
// `/home` through). `/` redirects here (`proxy.ts`).
export default function HomePage() {
  return <Landing />;
}
