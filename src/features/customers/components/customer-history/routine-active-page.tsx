"use client";

import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomerRoutineWorkspace } from "@/lib/training/types";
import {
  buildTrainingContextHelper,
  getRoutineDayCount,
  getRoutineExerciseCount,
  getStatusBadgeVariant,
  getStatusLabel,
  RoutineSummaryCard,
  RoutineViewer,
} from "./tabs/routine-workspace-shared";

interface RoutineActivePageProps {
  customerId: string;
  customerName: string;
  workspace: CustomerRoutineWorkspace;
}

export function RoutineActivePage({ customerId, customerName, workspace }: RoutineActivePageProps) {
  const backHref = `/panel/clientes/${customerId}/history#routine`;
  const draftHref = `/panel/clientes/${customerId}/rutina/borrador`;
  const activeRoutine = workspace.activeRoutine;
  const trainingContextHelper = buildTrainingContextHelper(workspace.trainingProfile);

  if (!activeRoutine) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Button asChild variant="ghost" className="h-auto px-0 text-muted-foreground hover:bg-transparent">
              <Link href={backHref}>
                <IconArrowLeft className="h-4 w-4" />
                Volver al perfil
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Rutina aprobada</h1>
              <p className="text-sm text-muted-foreground">{customerName}</p>
            </div>
          </div>
        </div>

        <Card className="border-border/70">
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-lg font-semibold">Todavía no hay una rutina aprobada activa</p>
            <p className="text-sm text-muted-foreground">
              Aprueba un borrador desde la pestaña de rutina para consultar aquí la versión activa en solo lectura.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link href={backHref}>Volver a Rutina</Link>
              </Button>
              {workspace.draftRoutine ? (
                <Button asChild>
                  <Link href={draftHref}>Abrir borrador</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-6 pb-8">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <Button asChild variant="ghost" className="h-auto px-0 text-muted-foreground hover:bg-transparent">
                  <Link href={backHref}>
                    <IconArrowLeft className="h-4 w-4" />
                    Volver al perfil
                  </Link>
                </Button>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight">Rutina aprobada</h1>
                    <Badge variant={getStatusBadgeVariant(activeRoutine.status)}>
                      {getStatusLabel(activeRoutine.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {customerName} · {activeRoutine.name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{getRoutineDayCount(workspace.activeDetails)} días</Badge>
                <Badge variant="secondary">{getRoutineExerciseCount(workspace.activeDetails)} ejercicios</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <RoutineSummaryCard
              title="Cliente"
              value={customerName}
              helper={activeRoutine.primary_goal ? `Objetivo: ${activeRoutine.primary_goal}` : undefined}
            />
            <RoutineSummaryCard
              title="Perfil de entrenamiento"
              value={getStatusLabel(workspace.trainingProfileStatus)}
              helper={trainingContextHelper || "Sin contexto suficiente para resumir."}
            />
            <RoutineSummaryCard
              title="Rutina activa"
              value={activeRoutine.name}
              helper={`${getRoutineDayCount(workspace.activeDetails)} días • ${getRoutineExerciseCount(workspace.activeDetails)} ejercicios`}
            />
          </div>

          <RoutineViewer
            title="Rutina activa"
            routine={activeRoutine}
            details={workspace.activeDetails}
            editable={false}
            editors={{}}
            onEditorChange={() => undefined}
            onSave={async () => undefined}
            onReplace={() => undefined}
            busyDetailId={null}
          />
        </div>
      </div>

      <div className="border-t bg-background/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Esta vista conserva la rutina aprobada en solo lectura para consulta rápida y trazabilidad.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={backHref}>Volver al perfil</Link>
            </Button>
            {workspace.draftRoutine ? (
              <Button asChild>
                <Link href={draftHref}>Abrir borrador nuevo</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
