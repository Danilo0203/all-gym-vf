'use client';

import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';
import { usePayments } from '@/features/payments/hooks/use-payments';
import { PaymentTable } from './payment-tables/payment-table';
import { MethodOption } from './payment-tables/columns';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function PaymentListingPage() {
  const [page] = useQueryState('page', parseAsInteger.withDefault(1));
  const [perPage] = useQueryState('perPage', parseAsInteger.withDefault(10));
  const [user_name] = useQueryState('user_name', parseAsString);
  const [method] = useQueryState('method', parseAsString);
  const [payment_date] = useQueryState('payment_date', parseAsString);
  const [subscription_status] = useQueryState('subscription_status', parseAsString);

  const { data, isLoading, isError, error } = usePayments({
    page,
    perPage,
    user_name,
    method,
    payment_date,
    subscription_status
  });

  const methodOptions: MethodOption[] = [
    { label: 'Efectivo', value: 'cash' },
    { label: 'Tarjeta', value: 'card' },
    { label: 'Transferencia', value: 'transfer' }
  ];

  if (isLoading) {
    return <DataTableSkeleton columnCount={6} rowCount={perPage} filterCount={3} />;
  }

  if (isError) {
    return (
      <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
        Error al cargar pagos: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <PaymentTable
      data={data?.data || []}
      totalItems={data?.total || 0}
      methodOptions={methodOptions}
    />
  );
}
