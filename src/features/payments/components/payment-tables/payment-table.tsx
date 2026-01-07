'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { getColumns, Payment, MethodOption } from './columns';
import { parseAsInteger, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportToCSV } from '@/lib/utils';
import { format } from 'date-fns';
import { useMemo } from 'react';

interface PaymentTableProps {
  data: Payment[];
  totalItems: number;
  methodOptions?: MethodOption[];
}

export function PaymentTable({
  data,
  totalItems,
  methodOptions = []
}: PaymentTableProps) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));
  const pageCount = Math.ceil(totalItems / pageSize);

  // Generate columns with method options (memoized)
  const columns = useMemo(() => getColumns(methodOptions), [methodOptions]);

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500,
    initialState: {
      columnVisibility: {
        subscription_status: false
      }
    }
  });

  const handleExport = () => {
    const exportData = data.map(p => ({
      Fecha: format(new Date(p.payment_date), 'yyyy-MM-dd HH:mm'),
      Cliente: p.user_name,
      Plan: p.plan_name,
      Metodo: p.method,
      Monto: p.amount_paid
    }));
    exportToCSV(exportData, `pagos-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table}>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExport}
          className="ml-auto flex h-8 gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </DataTableToolbar>
    </DataTable>
  );
}
