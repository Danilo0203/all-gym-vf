import Link from "next/link";
import {
  IconBarbell,
  IconCalendar,
  IconListDetails,
  IconTargetArrow,
  IconUser,
} from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PRIMARY_GOAL_OPTIONS } from "@/lib/training/options";
import { cn } from "@/lib/utils";
import type { RoutineStatus } from "@/lib/training/types";

import {
  getAllRoutines,
  type RoutineWithCustomer,
} from "../actions/routines-actions";

const STATUS_CONFIG: Record<
  RoutineStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  pending_profile: {
    label: "Perfil pendiente",
    dotClass: "bg-slate-400",
    badgeClass:
      "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
  },
  draft: {
    label: "Borrador",
    dotClass: "bg-amber-500",
    badgeClass:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  active: {
    label: "Activa",
    dotClass: "bg-emerald-500",
    badgeClass:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  archived: {
    label: "Archivada",
    dotClass: "bg-slate-400",
    badgeClass:
      "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
  },
};

function getPrimaryGoalLabel(value: string | null) {
  if (!value) return null;
  return PRIMARY_GOAL_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function getInitials(name: string | null, fallback: string) {
  const source = (name ?? fallback).trim();
  if (!source) return "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function routineHref(routine: RoutineWithCustomer) {
  if (!routine.user_id) return "#";
  if (routine.status === "active") {
    return `/panel/clientes/${routine.user_id}/rutina/activa`;
  }
  return `/panel/clientes/${routine.user_id}/rutina/borrador`;
}

function RoutineCard({ routine }: { routine: RoutineWithCustomer }) {
  const status = STATUS_CONFIG[routine.status] ?? STATUS_CONFIG.draft;
  const goalLabel = getPrimaryGoalLabel(routine.primary_goal);
  const customerLabel = routine.customer_name ?? "Cliente sin asignar";
  const updatedAt = formatDate(routine.reviewed_at ?? routine.created_at ?? null);
  const href = routineHref(routine);

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden border-border/70 transition-all hover:border-primary/40 hover:shadow-md">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant="outline"
            className={cn("gap-1.5 font-medium", status.badgeClass)}
          >
            <span className={cn("size-1.5 rounded-full", status.dotClass)} />
            {status.label}
          </Badge>
          {routine.source === "admin" ? (
            <Badge variant="secondary" className="text-xs">
              Manual
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              IA
            </Badge>
          )}
        </div>
        <div className="flex items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconBarbell className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold leading-snug">
              {routine.name}
            </h3>
            {goalLabel ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <IconTargetArrow className="size-3.5" />
                <span className="truncate">{goalLabel}</span>
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-2">
          <Avatar className="size-8">
            <AvatarImage src={routine.customer_avatar ?? undefined} alt={customerLabel} />
            <AvatarFallback className="text-xs">
              {getInitials(routine.customer_name, "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              {customerLabel}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconUser className="size-3" />
              Cliente
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/60 bg-background p-2">
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconCalendar className="size-3" /> Días
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {routine.day_count}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background p-2">
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconListDetails className="size-3" /> Ejercicios
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {routine.exercise_count}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {updatedAt ? `Actualizada ${updatedAt}` : "Sin fecha"}
        </span>
        <Button asChild size="sm" variant="ghost" disabled={!routine.user_id}>
          <Link href={href}>Ver rutina</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <IconBarbell className="size-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Aún no hay rutinas guardadas</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando generes o guardes rutinas para tus clientes, aparecerán aquí.
        </p>
      </div>
    </div>
  );
}

export default async function RoutinesListing() {
  const routines = await getAllRoutines();

  if (routines.length === 0) {
    return <EmptyState />;
  }

  const totals = routines.reduce(
    (acc, r) => {
      if (r.status === "draft") acc.draft += 1;
      else if (r.status === "active") acc.active += 1;
      else if (r.status === "archived") acc.archived += 1;
      return acc;
    },
    { draft: 0, active: 0, archived: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Total" value={routines.length} accent="bg-primary/10 text-primary" />
        <SummaryTile
          label="Activas"
          value={totals.active}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <SummaryTile
          label="Borradores"
          value={totals.draft}
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <SummaryTile
          label="Archivadas"
          value={totals.archived}
          accent="bg-slate-500/10 text-slate-600 dark:text-slate-300"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {routines.map((routine) => (
          <RoutineCard key={routine.id} routine={routine} />
        ))}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
      <div className={cn("flex size-9 items-center justify-center rounded-lg", accent)}>
        <IconBarbell className="size-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}
