import PeopleTab from '../PeopleTab';

// The list lives in the layout, so choosing another person (`/admin/people/<id>`) keeps it and its data loaded.
export default function AdminPeopleLayout({ children }: LayoutProps<'/admin/people'>) {
  return (
    <>
      <PeopleTab />
      {children}
    </>
  );
}
