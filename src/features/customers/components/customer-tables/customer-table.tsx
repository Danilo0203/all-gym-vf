"use client";

import { DataTable } from "@/components/ui/table/data-table";
import { DataTableToolbar } from "@/components/ui/table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { getColumns, Customer, PlanOption } from "./columns";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

interface CustomerTableProps {
  data: Customer[];
  totalItems: number;
  planOptions?: PlanOption[];
}

export function CustomerTable({ data, totalItems, planOptions = [] }: CustomerTableProps) {
  const router = useRouter();
  const [pageSize] = useQueryState("perPage", parseAsInteger.withDefault(10));

  const pageCount = Math.ceil(totalItems / pageSize);

  // Generar columnas con las opciones de planes (memoizado)
  const columns = useMemo(() => getColumns(planOptions), [planOptions]);

  const { table } = useDataTable({
    data,
    columns,
    pageCount: pageCount,
    shallow: false,
    debounceMs: 500,
  });

  const handleRowClick = (customer: Customer) => {
    router.push(`/panel/clientes/${customer.id}/history`);
  };

  return (
    <DataTable
      table={table}
      onRowClick={handleRowClick}
      getRowClassName={(row) => (!row.is_active ? "opacity-50 grayscale" : "")}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
