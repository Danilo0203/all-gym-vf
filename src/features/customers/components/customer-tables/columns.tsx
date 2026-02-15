"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";

export type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  plan_name: string | null;
  last_check_in: string | null;
  is_active: boolean | null;
  email: string | null;
};

export interface PlanOption {
  label: string;
  value: string;
}

// Función factory para crear columnas con opciones dinámicas
export function getColumns(planOptions: PlanOption[] = []): ColumnDef<Customer>[] {
  return [
    {
      id: "full_name",
      accessorKey: "full_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="CLIENTE" />,
      enableColumnFilter: true,
      meta: {
        label: "Buscar por nombre...",
        placeholder: "Buscar por nombre...",
        variant: "text" as const,
      },
      cell: ({ row }) => {
        const { full_name, avatar_url } = row.original;
        const initials = full_name
          ? full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .substring(0, 2)
          : "??";

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatar_url || ""} alt={full_name || ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium text-sm">{full_name}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => <DataTableColumnHeader column={column} title="ACTIVO" />,
      enableColumnFilter: true,
      meta: {
        label: "Estado",
        variant: "multiSelect" as const,
        options: [
          { label: "Activo", value: "Active" },
          { label: "Inactivo", value: "Inactive" },
        ],
      },
      cell: ({ row }) => {
        const isActive = row.original.is_active;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
            }`}
          >
            {isActive ? "Activo" : "Inactivo"}
          </span>
        );
      },
    },
    {
      accessorKey: "subscription_status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="SUSCRIPCIÓN" />,
      cell: ({ row }) => (
        <SubscriptionStatusBadge
          status={row.original.subscription_status}
          endDate={row.original.subscription_end_date}
        />
      ),
    },
    {
      id: "plan_name",
      accessorKey: "plan_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="PLAN ACTUAL" />,
      enableColumnFilter: true,
      meta: {
        label: "Plan",
        variant: "multiSelect" as const,
        options: planOptions,
      },
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.plan_name || "-"}</span>,
    },
    {
      accessorKey: "subscription_start_date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="INICIO" />,
      cell: ({ row }) => {
        const date = row.original.subscription_start_date;
        if (!date) return <span className="text-muted-foreground">-</span>;

        let parsedDate: Date;
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          const [year, month, day] = date.split("-").map(Number);
          parsedDate = new Date(year, month - 1, day);
        } else {
          parsedDate = new Date(date);
        }

        return <span className="text-sm text-muted-foreground">{format(parsedDate, "dd/MM/yyyy")}</span>;
      },
    },
    {
      accessorKey: "subscription_end_date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="VENCIMIENTO" />,
      cell: ({ row }) => {
        const date = row.original.subscription_end_date;
        if (!date) return <span className="text-muted-foreground">-</span>;

        let parsedDate: Date;
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          const [year, month, day] = date.split("-").map(Number);
          parsedDate = new Date(year, month - 1, day);
        } else {
          parsedDate = new Date(date);
        }

        const daysLeft = differenceInDays(parsedDate, new Date());

        let textClass = "text-muted-foreground";
        if (daysLeft < 0) textClass = "text-destructive font-medium";
        else if (daysLeft <= 3) textClass = "text-yellow-600 font-medium";

        return (
          <div className="flex flex-col">
            <span className={textClass}>{format(parsedDate, "dd/MM/yyyy")}</span>
            {daysLeft >= 0 && daysLeft <= 30 && (
              <span className="text-[10px] text-muted-foreground">En {daysLeft} días</span>
            )}
            {daysLeft < 0 && (
              <span className="text-[10px] text-destructive">Venció hace {Math.abs(daysLeft)} días</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="TELÉFONO" />,
      cell: ({ row }) => {
        const phone = row.original.phone;
        if (!phone) return <span className="text-muted-foreground">-</span>;

        const cleanPhone = phone.replace(/\D/g, "");

        return (
          <Link
            href={`https://wa.me/${cleanPhone}`}
            target="_blank"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <IconBrandWhatsapp className="h-4 w-4" />
            {phone}
          </Link>
        );
      },
    },
    {
      accessorKey: "last_check_in",
      header: ({ column }) => <DataTableColumnHeader column={column} title="ÚLTIMO INGRESO" />,
      cell: ({ row }) => {
        const date = row.original.last_check_in;
        if (!date) return <span className="text-muted-foreground text-xs">Nunca</span>;
        return (
          <span className="text-sm text-muted-foreground">
            {format(new Date(date), "dd MMM HH:mm", { locale: es })}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <CellAction data={row.original} />,
    },
  ];
}

// Export estático para compatibilidad (sin opciones de plan dinámicas)
export const columns = getColumns([]);
