import LegalPage from '../LegalPage';

export default async function Page({ searchParams }: PageProps<'/terms'>) {
  const { lang, version } = await searchParams;
  return <LegalPage page="terms" lang={lang} version={version} />;
}
