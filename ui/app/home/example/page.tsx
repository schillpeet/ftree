import type { Metadata } from 'next';
import ExampleTree from '../ExampleTree';

export const metadata: Metadata = {
  title: 'ftree · Beispielfamilie',
};

// The read-only example tree, public like the landing page (under `/home`, which Cloudflare Access lets through).
export default function ExamplePage() {
  return <ExampleTree />;
}
