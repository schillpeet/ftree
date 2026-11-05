import { ImprintPage } from '../LegalPage';

export default async function Page({ searchParams }: PageProps<'/imprint'>) {
  return <ImprintPage lang={(await searchParams).lang} />;
}
