"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TRAINING_LOCATION_OPTIONS } from "@/lib/training/options";
import { formatSessionDuration } from "@/lib/training/profile-defaults";
import type { CustomerRoutineWorkspace, RoutineDetailRecord, RoutineRecord } from "@/lib/training/types";
import {
  approveRoutineDraft,
  archiveRoutine,
  generateRoutineProposal,
} from "@/features/customers/actions/customer-routine-actions";
import {
  buildTrainingContextHelper,
  getPrimaryGoalLabel,
  getRoutineDayCount,
  getRoutineExerciseCount,
  getStatusBadgeVariant,
  getStatusLabel,
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

function getTrainingContextSummary(workspace: CustomerRoutineWorkspace) {
  const profile = workspace.trainingProfile;
  const locationLabel = profile?.training_location
    ? TRAINING_LOCATION_OPTIONS.find((item) => item.value === profile.training_location)?.label
    : null;

  return [
    profile?.primary_goal ? `Objetivo: ${getPrimaryGoalLabel(profile.primary_goal)}` : null,
    profile?.days_per_week ? `${profile.days_per_week} días/semana` : null,
    profile?.session_minutes ? `${formatSessionDuration(profile.session_minutes)} por sesión` : null,
    locationLabel ? `Lugar: ${locationLabel}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" • ");
}

function getNextStepTitle(workspace: CustomerRoutineWorkspace) {
  if (workspace.missingRequirements.length > 0) {
    return "Completa la ficha antes de generar";
  }

  if (workspace.draftRoutine) {
    return workspace.activeRoutine ? "Revisa el borrador antes de reemplazar la activa" : "Revisa y activa el borrador";
  }

  if (workspace.activeRoutine) {
    return "La rutina activa ya está publicada";
  }

  return "Genera la primera propuesta";
}

function getNextStepDescription(workspace: CustomerRoutineWorkspace) {
  if (workspace.missingRequirements.length > 0) {
    return `Faltan ${workspace.missingRequirements.length} dato${workspace.missingRequirements.length === 1 ? "" : "s"} clave para personalizar la rutina.`;
  }

  if (workspace.draftRoutine) {
    return workspace.activeRoutine
      ? "La versión activa seguirá visible para el cliente hasta que apruebes el borrador."
      : "El borrador ya existe y todavía no está visible para el cliente.";
  }

  if (workspace.activeRoutine) {
    return "Puedes abrir la versión vigente o generar una nueva propuesta cuando quieras iterar.";
  }

  return "La propuesta aparecerá aquí lista para revisión en cuanto la generes.";
}

function getWorkspaceNarrative(workspace: CustomerRoutineWorkspace) {
  if (workspace.draftRoutine && workspace.activeRoutine) {
    return "Hay un borrador nuevo listo para revisión y una rutina activa que sigue visible hasta aprobar cambios.";
  }

  if (workspace.draftRoutine) {
    return "Existe un borrador listo para revisión. El siguiente paso natural es abrirlo y decidir si se activa.";
  }

  if (workspace.activeRoutine) {
    return "La rutina activa ya está publicada. Desde aquí solo necesitas abrirla o generar una nueva iteración.";
  }

  if (workspace.pendingRoutine || workspace.missingRequirements.length > 0) {
    return "Todavía no hay una rutina utilizable porque faltan datos en la ficha del cliente.";
  }

  return "Todavía no se ha generado ninguna rutina para este cliente.";
}

function getGenerateLabel(workspace: CustomerRoutineWorkspace) {
  return workspace.draftRoutine || workspace.activeRoutine || workspace.pendingRoutine
    ? "Generar nueva propuesta"
    : "Generar propuesta";
}

function RoutineStageRow({
  eyebrow,
  title,
  routine,
  details,
  description,
  tone,
  timestampLabel,
}: {
  eyebrow: string;
  title: string;
  routine: RoutineRecord;
  details: RoutineDetailRecord[];
  description: string;
  tone: "draft" | "active";
  timestampLabel: string;
}) {
  const timestamp = formatRoutineTimestamp(
    tone === "active" ? routine.reviewed_at || routine.created_at : routine.created_at,
  );
  const primaryGoalLabel = getPrimaryGoalLabel(routine.primary_goal);
  const toneClasses =
    tone === "draft"
      ? "border-amber-200/40 bg-gradient-to-br from-amber-50/50 to-amber-100/20"
      : "border-emerald-200/40 bg-gradient-to-br from-emerald-50/50 to-emerald-100/20";
  const iconBgClasses =
    tone === "draft"
      ? "bg-amber-100/60 border-amber-200/50 text-amber-700"
      : "bg-emerald-100/60 border-emerald-200/50 text-emerald-700";
  const icon =
    tone === "draft" ? (
      <ClipboardList className="size-5" />
    ) : (
      <CheckCircle2 className="size-5" />
    );

  return (
    <section className={`rounded-2xl border px-5 py-5 ${toneClasses} transition-all hover:shadow-sm`}>
      <div className="space-y-4">
        {/* Header Section */}
        <div className="flex items-start gap-4">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg border ${iconBgClasses}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {eyebrow}
            </p>
            <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
          </div>
          <Badge variant={getStatusBadgeVariant(routine.status)} className="shrink-0">
            {getStatusLabel(routine.status)}
          </Badge>
        </div>

        {/* Routine Name and Description */}
        <div className="space-y-2 pl-12">
          <p className="text-sm font-semibold text-foreground">{routine.name}</p>
          <p className="text-sm leading-6 text-muted-foreground max-w-2xl">{description}</p>
        </div>

        {/* Metadata Section */}
        <div className="border-t border-current/10 pt-4 pl-12 flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="text-xs font-medium">
            {getRoutineDayCount(details)} días
          </Badge>
          <Badge variant="secondary" className="text-xs font-medium">
            {getRoutineExerciseCount(details)} ejercicios
          </Badge>
          {primaryGoalLabel ? (
            <Badge variant="outline" className="text-xs font-medium">
              {primaryGoalLabel}
            </Badge>
          ) : null}
          {timestamp ? (
            <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
              {timestampLabel} {timestamp}
            </Badge>
          ) : null}
        </div>
      </div>
    </section>
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
  const trainingContextSummary = getTrainingContextSummary(workspace);
  const draftHref = `/panel/clientes/${customerId}/rutina/borrador`;
  const activeHref = `/panel/clientes/${customerId}/rutina/activa`;
  const canGenerate = workspace.missingRequirements.length === 0;
  const generateLabel = getGenerateLabel(workspace);
  const hasRoutines = Boolean(workspace.draftRoutine || workspace.activeRoutine);

  return (
    <div className="space-y-6">
      {/* Narrative & Context Section */}
      <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/10">
        <CardContent className="space-y-4 px-6 py-6">
          <div className="space-y-3">
            <p className="max-w-3xl text-sm leading-7 text-foreground/85">{getWorkspaceNarrative(workspace)}</p>

            {trainingContextSummary ? (
              <p className="text-sm leading-6 text-muted-foreground font-medium">{trainingContextSummary}</p>
            ) : trainingContextHelper ? (
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-medium">Base actual:</span> {trainingContextHelper}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Aún no hay suficiente contexto de entrenamiento para resumir la ficha.
              </p>
            )}
          </div>

          {workspace.missingRequirements.length > 0 ? (
            <div className="rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50/60 to-amber-100/20 px-4 py-3 mt-2">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-amber-900">Pendientes para generar una rutina personalizada</p>
                  <div className="flex flex-wrap gap-2">
                    {workspace.missingRequirements.map((item) => (
                      <Badge
                        key={item}
                        variant="outline"
                        className="border-amber-200/60 bg-background/80 text-amber-950 font-medium text-xs"
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Next Step Section */}
      <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-primary/5 via-card to-muted/10 shadow-sm">
        <CardContent className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Siguiente paso</p>
            <h3 className="text-lg font-bold tracking-tight text-foreground">{getNextStepTitle(workspace)}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{getNextStepDescription(workspace)}</p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {workspace.draftRoutine ? (
              <>
                <Button asChild size="default" className="w-full">
                  <Link href={draftHref}>Revisar borrador</Link>
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="w-full"
                >
                  {isApproving ? "Aprobando..." : "Aprobar y activar"}
                </Button>
              </>
            ) : workspace.activeRoutine ? (
              <>
                <Button asChild size="default" variant="secondary" className="w-full">
                  <Link href={activeHref}>Abrir rutina activa</Link>
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="w-full"
                >
                  <RefreshCw className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
                  {isGenerating ? "Generando..." : generateLabel}
                </Button>
              </>
            ) : (
              <Button
                size="default"
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="w-full"
              >
                <RefreshCw className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Generando..." : generateLabel}
              </Button>
            )}

            {workspace.draftRoutine && canGenerate ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="justify-center mt-1"
              >
                <RefreshCw className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Generando..." : "Generar otra propuesta"}
              </Button>
            ) : null}

            {workspace.activeRoutine && !workspace.draftRoutine ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleArchiveActive}
                disabled={isArchiving}
                className="justify-center text-muted-foreground hover:text-foreground"
              >
                {isArchiving ? "Archivando..." : "Archivar rutina"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Routines Display Section */}
      {hasRoutines ? (
        <div className="space-y-3">
          {workspace.draftRoutine ? (
            <RoutineStageRow
              eyebrow="Borrador"
              title="Listo para revisión"
              routine={workspace.draftRoutine}
              details={workspace.draftDetails}
              description={
                workspace.activeRoutine
                  ? "Revísalo antes de reemplazar la rutina que hoy sigue activa para el cliente."
                  : "Revísalo y actívalo cuando quieras publicarlo para el cliente."
              }
              tone="draft"
              timestampLabel="Generado"
            />
          ) : null}

          {workspace.activeRoutine ? (
            <RoutineStageRow
              eyebrow="Rutina activa"
              title="Versión visible para el cliente"
              routine={workspace.activeRoutine}
              details={workspace.activeDetails}
              description={
                workspace.draftRoutine
                  ? "Sigue siendo la versión publicada hasta que apruebes el borrador."
                  : "Es la versión vigente y se mantiene en solo lectura para preservar trazabilidad."
              }
              tone="active"
              timestampLabel="Activa"
            />
          ) : null}
        </div>
      ) : (
        <Card className="overflow-hidden border-border/50 border-dashed bg-muted/10">
          <CardContent className="space-y-3 px-6 py-8">
            <p className="text-base font-semibold tracking-tight">
              {workspace.pendingRoutine || workspace.missingRequirements.length > 0
                ? "La rutina sigue en espera"
                : "Todavía no hay una rutina generada"}
            </p>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {workspace.pendingRoutine || workspace.missingRequirements.length > 0
                ? "Completa la ficha del cliente y después genera una propuesta para desbloquear el flujo."
                : "Cuando generes una propuesta aparecerá aquí lista para revisión y activación."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
