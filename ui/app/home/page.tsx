import type { Metadata } from 'next';
import Landing from './Landing';

export const metadata: Metadata = {
  title: 'ftree · Deine Familie. Ein Baum, der mit euch wächst.',
};

// The landing page: outside the `(tree)` group, so it loads no `/me`; Cloudflare Access still asks for the sign-in.
// `/` redirects here (`proxy.ts`).
export default function HomePage() {
  return <Landing />;
}
