"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientErrorState, ClientLoadingState } from "@/features/client/components/client-resource-state";
import { ClientSyncStatus } from "@/features/client/components/client-sync-status";
import { useClientRoutine } from "@/features/client/hooks/use-client-api";
import {
  buildTrainingContextHelper,
  getRoutineDayCount,
  getRoutineExerciseCount,
  getStatusBadgeVariant,
  getStatusLabel,
  RoutineSummaryCard,
  RoutineViewer,
} from "@/features/customers/components/customer-history/tabs/routine-workspace-shared";

export function ClientRoutineScreen() {
  const routineQuery = useClientRoutine();

  if (routineQuery.isPending) {
    return <ClientLoadingState title="Cargando tu rutina actual..." />;
  }

  if (routineQuery.isError) {
    return (
      <ClientErrorState
        title="No fue posible cargar tu rutina"
        description="Revisa tu conexión o vuelve a intentar en unos segundos."
      />
    );
  }

  const { data, meta } = routineQuery.data;
  const activeRoutine = data.workspace.activeRoutine;
  const trainingContextHelper = buildTrainingContextHelper(data.workspace.trainingProfile);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <ClientSyncStatus meta={meta} />
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight">Tu rutina</h2>
          <p className="text-sm text-muted-foreground">
            Revisa la versión activa de tu plan de entrenamiento y guárdala en tu teléfono.
          </p>
        </div>
      </div>

      {!activeRoutine ? (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Aún no hay una rutina activa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Tu entrenador todavía no ha aprobado una rutina activa para tu cuenta.
            </p>
            <p>Cuando la rutina esté lista aparecerá aquí automáticamente.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <RoutineSummaryCard
              title="Cliente"
              value={data.customer_name}
              helper={activeRoutine.primary_goal ? `Objetivo: ${activeRoutine.primary_goal}` : undefined}
            />
            <RoutineSummaryCard
              title="Perfil"
              value={getStatusLabel(data.workspace.trainingProfileStatus)}
              helper={trainingContextHelper || "Perfil pendiente de completar."}
            />
            <RoutineSummaryCard
              title="Rutina activa"
              value={activeRoutine.name}
              helper={`${getRoutineDayCount(data.workspace.activeDetails)} días • ${getRoutineExerciseCount(data.workspace.activeDetails)} ejercicios`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={getStatusBadgeVariant(activeRoutine.status)}>{getStatusLabel(activeRoutine.status)}</Badge>
            <Badge variant="secondary">{getRoutineDayCount(data.workspace.activeDetails)} días</Badge>
            <Badge variant="secondary">{getRoutineExerciseCount(data.workspace.activeDetails)} ejercicios</Badge>
          </div>

          <RoutineViewer
            title="Rutina aprobada"
            routine={activeRoutine}
            details={data.workspace.activeDetails}
            editable={false}
            editors={{}}
            onEditorChange={() => undefined}
            onSave={async () => undefined}
            onReplace={() => undefined}
            busyDetailId={null}
          />
        </>
      )}
    </div>
  );
}
