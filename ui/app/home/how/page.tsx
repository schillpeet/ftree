import type { Metadata } from 'next';
import HowItWorks from '../HowItWorks';

export const metadata: Metadata = {
  title: 'ftree · So funktioniert’s',
};

// The three steps, public like the landing page (under `/home`, which Cloudflare Access lets through).
export default function HowPage() {
  return <HowItWorks />;
}
