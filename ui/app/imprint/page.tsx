import LegalPage from '../LegalPage';

export default async function Page({ searchParams }: PageProps<'/imprint'>) {
  return <LegalPage page="imprint" lang={(await searchParams).lang} />;
}
