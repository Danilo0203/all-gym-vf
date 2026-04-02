
import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import CustomerListingPage from '@/features/customers/components/customer-listing';
import { CustomerFormSheet } from '@/features/customers/components/customer-form-sheet';
import { searchParamsCache } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

export const metadata = {
  title: 'Panel: Clientes'
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const searchParams = await props.searchParams;
  // Allow nested RSCs to access the search params (in a type-safe way)
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      scrollable={false}
      pageTitle='Clientes'
      pageDescription='Administración de clientes'
      pageHeaderAction={<CustomerFormSheet />}
    >
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={5} rowCount={8} filterCount={2} />
        }
      >
        <CustomerListingPage />
      </Suspense>
    </PageContainer>
  );
}
