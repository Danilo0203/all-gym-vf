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
      ? "border-amber-500/25 bg-amber-500/[0.06]"
      : "border-emerald-500/25 bg-emerald-500/[0.06]";
  const icon =
    tone === "draft" ? (
      <ClipboardList className="size-5 text-amber-600" />
    ) : (
      <CheckCircle2 className="size-5 text-emerald-600" />
    );

  return (
    <section className={`rounded-2xl border px-4 py-4 ${toneClasses}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80">
              {icon}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {eyebrow}
                </p>
                <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                <Badge variant={getStatusBadgeVariant(routine.status)}>{getStatusLabel(routine.status)}</Badge>
                {primaryGoalLabel ? <Badge variant="outline">{primaryGoalLabel}</Badge> : null}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground/90">{routine.name}</p>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:justify-end">
          <Badge variant="secondary">{getRoutineDayCount(details)} días</Badge>
          <Badge variant="secondary">{getRoutineExerciseCount(details)} ejercicios</Badge>
          {timestamp ? <Badge variant="outline">{timestampLabel} {timestamp}</Badge> : null}
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
    <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-muted/20 py-0">
      <CardContent className="space-y-5 px-6 py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{getWorkspaceNarrative(workspace)}</p>

            {trainingContextSummary ? (
              <p className="text-sm leading-6 text-muted-foreground">{trainingContextSummary}</p>
            ) : trainingContextHelper ? (
              <p className="text-sm leading-6 text-muted-foreground">Base actual: {trainingContextHelper}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no hay suficiente contexto de entrenamiento para resumir la ficha.
              </p>
            )}

            {workspace.missingRequirements.length > 0 ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Pendientes para generar una rutina personalizada</p>
                    <div className="flex flex-wrap gap-2">
                      {workspace.missingRequirements.map((item) => (
                        <Badge
                          key={item}
                          variant="outline"
                          className="border-amber-500/30 bg-background/70 text-foreground"
                        >
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-3 xl:max-w-[320px] xl:shrink-0 xl:items-end">
            <div className="space-y-1 xl:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Siguiente paso
              </p>
              <p className="text-sm font-semibold tracking-tight">{getNextStepTitle(workspace)}</p>
              <p className="text-sm leading-6 text-muted-foreground">{getNextStepDescription(workspace)}</p>
            </div>

            <div className="flex w-full flex-wrap gap-2 xl:justify-end">
              {workspace.draftRoutine ? (
                <>
                  <Button asChild size="sm">
                    <Link href={draftHref}>Revisar borrador</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleApprove} disabled={isApproving}>
                    {isApproving ? "Aprobando..." : "Aprobar y activar"}
                  </Button>
                </>
              ) : workspace.activeRoutine ? (
                <>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={activeHref}>Abrir activa</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
                    <RefreshCw className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
                    {isGenerating ? "Generando..." : generateLabel}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
                  <RefreshCw className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
                  {isGenerating ? "Generando..." : generateLabel}
                </Button>
              )}
            </div>

            {workspace.draftRoutine && canGenerate ? (
              <Button size="sm" variant="link" onClick={handleGenerate} disabled={isGenerating} className="h-auto px-0">
                <RefreshCw className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Generando..." : "Generar otra propuesta"}
              </Button>
            ) : null}

            {workspace.activeRoutine && !workspace.draftRoutine ? (
              <Button
                size="sm"
                variant="link"
                onClick={handleArchiveActive}
                disabled={isArchiving}
                className="h-auto px-0 text-muted-foreground"
              >
                {isArchiving ? "Archivando..." : "Archivar rutina"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border/60 pt-5">
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
            <section className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5">
              <div className="space-y-2">
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
              </div>
            </section>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
