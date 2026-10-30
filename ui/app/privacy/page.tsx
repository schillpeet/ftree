import LegalPage from '../LegalPage';

export default async function Page({ searchParams }: PageProps<'/privacy'>) {
  return <LegalPage page="privacy" lang={(await searchParams).lang} />;
}
