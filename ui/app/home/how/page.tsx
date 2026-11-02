import type { Metadata } from 'next';
import HowItWorks from '../HowItWorks';

export const metadata: Metadata = {
  title: 'ftree · So funktioniert’s',
};

// The three steps, under `/home` and behind Cloudflare Access like the landing page.
export default function HowPage() {
  return <HowItWorks />;
}
