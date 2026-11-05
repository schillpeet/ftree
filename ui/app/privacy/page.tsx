import LegalPage from '../LegalPage';

export default async function Page({ searchParams }: PageProps<'/privacy'>) {
  const { lang, version } = await searchParams;
  return <LegalPage page="privacy" lang={lang} version={version} />;
}
