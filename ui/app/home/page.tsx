import type { Metadata } from 'next';
import { operator } from '../operator';
import Landing from './Landing';

export const metadata: Metadata = {
  title: 'ftree · Deine Familie. Ein Baum, der mit euch wächst.',
};

// The landing page: outside the `(tree)` group, so it loads no `/me`; Cloudflare Access still asks for the sign-in.
// `/` redirects here (`proxy.ts`). The operator's address, read per request, lets the profile link a request to delete the
// account.
export default async function HomePage() {
  const { email } = await operator();
  return <Landing feedbackEmail={email} />;
}
