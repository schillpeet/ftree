import LegalPage from '../LegalPage';

export default async function Page({ searchParams }: PageProps<'/terms'>) {
  return <LegalPage page="terms" lang={(await searchParams).lang} />;
}
