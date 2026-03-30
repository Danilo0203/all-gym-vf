"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerRoutineWorkspace, RoutineDetailRecord, RoutineRecord } from "@/lib/training/types";
import {
  approveRoutineDraft,
  archiveRoutine,
  generateRoutineProposal,
} from "@/features/customers/actions/customer-routine-actions";
import {
  buildTrainingContextHelper,
  getRoutineDayCount,
  getRoutineExerciseCount,
  getStatusBadgeVariant,
  getStatusLabel,
  RoutineSummaryCard,
} from "./routine-workspace-shared";

interface RoutineWorkspaceTabProps {
  customerId: string;
  workspace: CustomerRoutineWorkspace;
}

function formatRoutineTimestamp(value: string | undefined) {
  if (!value) return null;

  try {
    return formatDistanceToNow(new Date(value), { locale: es, addSuffix: true });
  } catch {
    return null;
  }
}

function RoutineSnapshotCard({
  title,
  routine,
  details,
  helper,
  actions,
}: {
  title: string;
  routine: RoutineRecord;
  details: RoutineDetailRecord[];
  helper?: string;
  actions?: React.ReactNode;
}) {
  const generatedAt = formatRoutineTimestamp(routine.created_at);

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              <Badge variant={getStatusBadgeVariant(routine.status)}>{getStatusLabel(routine.status)}</Badge>
              {routine.primary_goal ? <Badge variant="outline">{routine.primary_goal}</Badge> : null}
            </div>
            <p className="text-sm font-medium">{routine.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{getRoutineDayCount(details)} días</Badge>
            <Badge variant="secondary">{getRoutineExerciseCount(details)} ejercicios</Badge>
          </div>
        </div>
        {helper ? <p className="text-sm text-muted-foreground">{helper}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {generatedAt ? <p className="text-xs text-muted-foreground">Generado {generatedAt}</p> : null}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

export function RoutineWorkspaceTab({ customerId, workspace }: RoutineWorkspaceTabProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const result = await generateRoutineProposal(customerId);

      if (!result.success) {
        toast.error(result.error || "Aún faltan datos para generar la propuesta.");
      } else {
        toast.success("Propuesta de rutina generada.");
      }

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar la propuesta.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!workspace.draftRoutine) return;

    try {
      setIsApproving(true);
      await approveRoutineDraft(workspace.draftRoutine.id);
      toast.success("Rutina aprobada y activada.");
      router.push(`/panel/clientes/${customerId}/rutina/activa`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aprobar la rutina.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleArchiveActive = async () => {
    if (!workspace.activeRoutine) return;

    try {
      setIsArchiving(true);
      await archiveRoutine(workspace.activeRoutine.id);
      toast.success("Rutina archivada.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo archivar la rutina.");
    } finally {
      setIsArchiving(false);
    }
  };

  const trainingContextHelper = buildTrainingContextHelper(workspace.trainingProfile);
  const draftHref = `/panel/clientes/${customerId}/rutina/borrador`;
  const activeHref = `/panel/clientes/${customerId}/rutina/activa`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <RoutineSummaryCard
          title="Estado del perfil"
          value={getStatusLabel(workspace.trainingProfileStatus)}
          helper={trainingContextHelper || "Completa el contexto del cliente para generar una propuesta coherente."}
        />
        <RoutineSummaryCard
          title="Borrador"
          value={workspace.draftRoutine ? "Disponible" : "Sin borrador"}
          helper={
            workspace.draftRoutine
              ? `${getRoutineDayCount(workspace.draftDetails)} días • ${getRoutineExerciseCount(workspace.draftDetails)} ejercicios`
              : "Genera una propuesta cuando el perfil esté listo."
          }
        />
        <RoutineSummaryCard
          title="Rutina activa"
          value={workspace.activeRoutine ? "Sí" : "No"}
          helper={
            workspace.activeRoutine
              ? `${getRoutineDayCount(workspace.activeDetails)} días • ${getRoutineExerciseCount(workspace.activeDetails)} ejercicios`
              : "Aún no hay una rutina aprobada."
          }
        />
        <RoutineSummaryCard
          title="Datos faltantes"
          value={
            workspace.missingRequirements.length === 0 ? "Completado" : `${workspace.missingRequirements.length} pendientes`
          }
          helper={
            workspace.missingRequirements.length === 0
              ? "El perfil tiene lo mínimo para personalizar rutina."
              : "Completa los campos clave para salir del estado pendiente."
          }
        />
      </div>

      {workspace.missingRequirements.length > 0 ? (
        <Alert>
          <AlertTitle>Faltan datos para la rutina personalizada</AlertTitle>
          <AlertDescription>
            <p>El cliente ya existe, pero la rutina seguirá pendiente hasta completar estos datos:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              {workspace.missingRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/70">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base">Acciones de rutina</CardTitle>
            <Badge variant={getStatusBadgeVariant(workspace.trainingProfileStatus)}>
              Perfil {getStatusLabel(workspace.trainingProfileStatus)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            La propuesta automática se basa en objetivo, experiencia, días, duración, lugar de entrenamiento, equipo y
            restricciones capturadas en la ficha.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Generando..." : "Generar propuesta"}
          </Button>
          {workspace.draftRoutine ? (
            <Button asChild variant="outline">
              <Link href={draftHref}>Abrir borrador</Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleApprove} disabled={!workspace.draftRoutine || isApproving}>
            {isApproving ? "Aprobando..." : "Aprobar borrador"}
          </Button>
          {workspace.activeRoutine ? (
            <Button asChild variant="outline">
              <Link href={activeHref}>Ver rutina aprobada</Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleArchiveActive} disabled={!workspace.activeRoutine || isArchiving}>
            {isArchiving ? "Archivando..." : "Archivar rutina activa"}
          </Button>
        </CardContent>
      </Card>

      {workspace.pendingRoutine && !workspace.draftRoutine ? (
        <Card className="border-border/70">
          <CardContent className="p-6 text-sm text-muted-foreground">
            La rutina está en estado pendiente de perfil. Completa la ficha del cliente y vuelve a generar la propuesta.
          </CardContent>
        </Card>
      ) : null}

      {workspace.draftRoutine ? (
        <RoutineSnapshotCard
          title="Borrador de rutina"
          routine={workspace.draftRoutine}
          details={workspace.draftDetails}
          helper="Abre el borrador en su propia página para revisar días, ejercicios, series, descansos y notas sin saturar el perfil."
          actions={
            <>
              <Button asChild>
                <Link href={draftHref}>Abrir borrador</Link>
              </Button>
              <Button variant="outline" onClick={handleApprove} disabled={isApproving}>
                {isApproving ? "Aprobando..." : "Aprobar borrador"}
              </Button>
            </>
          }
        />
      ) : null}

      {workspace.activeRoutine ? (
        <RoutineSnapshotCard
          title="Rutina aprobada"
          routine={workspace.activeRoutine}
          details={workspace.activeDetails}
          helper="Abre la rutina aprobada en su propia página para revisar días, ejercicios, series y notas en solo lectura."
          actions={
            <>
              <Button asChild>
                <Link href={activeHref}>Ver rutina aprobada</Link>
              </Button>
              <Button variant="outline" onClick={handleArchiveActive} disabled={isArchiving}>
                {isArchiving ? "Archivando..." : "Archivar rutina activa"}
              </Button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
