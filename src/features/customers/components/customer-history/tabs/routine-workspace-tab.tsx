"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle2, ClipboardList, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function buildProfileHighlights(workspace: CustomerRoutineWorkspace) {
  const profile = workspace.trainingProfile;
  const locationLabel = profile?.training_location
    ? TRAINING_LOCATION_OPTIONS.find((item) => item.value === profile.training_location)?.label
    : null;

  return [
    profile?.primary_goal ? `Objetivo: ${getPrimaryGoalLabel(profile.primary_goal)}` : null,
    profile?.days_per_week ? `${profile.days_per_week} días/semana` : null,
    profile?.session_minutes ? `${formatSessionDuration(profile.session_minutes)} por sesión` : null,
    locationLabel ? `Lugar: ${locationLabel}` : null,
  ].filter((item): item is string => Boolean(item));
}

function getOverviewState(workspace: CustomerRoutineWorkspace) {
  if (workspace.draftRoutine) {
    return { label: "Revisión pendiente", variant: "warning" as const };
  }

  if (workspace.activeRoutine) {
    return { label: "Rutina activa", variant: "success" as const };
  }

  if (workspace.missingRequirements.length > 0 || workspace.pendingRoutine) {
    return { label: "Perfil incompleto", variant: "secondary" as const };
  }

  return { label: "Sin rutina", variant: "secondary" as const };
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

function RoutineStagePanel({
  eyebrow,
  title,
  routine,
  details,
  description,
  tone,
  timestampLabel,
  actions,
}: {
  eyebrow: string;
  title: string;
  routine: RoutineRecord;
  details: RoutineDetailRecord[];
  description: string;
  tone: "draft" | "active";
  timestampLabel: string;
  actions?: React.ReactNode;
}) {
  const timestamp = formatRoutineTimestamp(
    tone === "active" ? routine.reviewed_at || routine.created_at : routine.created_at,
  );
  const primaryGoalLabel = getPrimaryGoalLabel(routine.primary_goal);
  const toneClasses =
    tone === "draft"
      ? "border-amber-500/25 bg-amber-500/[0.08]"
      : "border-emerald-500/25 bg-emerald-500/[0.08]";
  const icon =
    tone === "draft" ? (
      <ClipboardList className="size-5 text-amber-600" />
    ) : (
      <CheckCircle2 className="size-5 text-emerald-600" />
    );

  return (
    <section className={`rounded-2xl border p-5 ${toneClasses}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80">
              {icon}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <Badge variant={getStatusBadgeVariant(routine.status)}>{getStatusLabel(routine.status)}</Badge>
                {primaryGoalLabel ? <Badge variant="outline">{primaryGoalLabel}</Badge> : null}
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium">{routine.name}</p>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{getRoutineDayCount(details)} días</Badge>
          <Badge variant="secondary">{getRoutineExerciseCount(details)} ejercicios</Badge>
          {timestamp ? <Badge variant="outline">{timestampLabel} {timestamp}</Badge> : null}
        </div>
      </div>

      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
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
  const profileHighlights = buildProfileHighlights(workspace);
  const overviewState = getOverviewState(workspace);
  const draftHref = `/panel/clientes/${customerId}/rutina/borrador`;
  const activeHref = `/panel/clientes/${customerId}/rutina/activa`;
  const canGenerate = workspace.missingRequirements.length === 0;
  const generateLabel = getGenerateLabel(workspace);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-muted/30">
        <CardContent className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,360px)]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusBadgeVariant(workspace.trainingProfileStatus)}>
                Perfil {getStatusLabel(workspace.trainingProfileStatus)}
              </Badge>
              <Badge variant={overviewState.variant}>{overviewState.label}</Badge>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Centro de rutina</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Genera nuevas propuestas, revisa el borrador y conserva visible la rutina activa sin repetir bloques ni
                acciones en toda la pantalla.
              </p>
            </div>

            {profileHighlights.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profileHighlights.map((item) => (
                  <Badge key={item} variant="outline" className="rounded-full border-border/70 bg-background/70 px-3 py-1">
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no hay suficiente contexto de entrenamiento para resumir la ficha.
              </p>
            )}

            {workspace.missingRequirements.length > 0 ? (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4">
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
            ) : (
              <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  La ficha ya tiene el contexto mínimo para generar una propuesta coherente.
                </p>
              </div>
            )}
          </div>

          <div className="flex h-full flex-col justify-between gap-5 rounded-2xl border border-border/70 bg-background/80 p-5 shadow-sm">
            <div className="space-y-4">
              <Badge variant="secondary" className="gap-1.5">
                <Sparkles className="size-3.5" />
                Siguiente paso
              </Badge>
              <div className="space-y-2">
                <p className="text-lg font-semibold tracking-tight">{getNextStepTitle(workspace)}</p>
                <p className="text-sm leading-6 text-muted-foreground">{getNextStepDescription(workspace)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating} className="w-full sm:w-auto">
                <RefreshCw className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Generando..." : generateLabel}
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                {canGenerate
                  ? workspace.draftRoutine || workspace.activeRoutine
                    ? "Se creará un nuevo borrador. La rutina activa no cambia hasta que lo apruebes."
                    : "Se creará una propuesta inicial basada en la ficha del cliente."
                  : "Completa primero los campos pendientes para habilitar la generación."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="space-y-4 border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Estado de la rutina</CardTitle>
                <Badge variant={overviewState.variant}>{overviewState.label}</Badge>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{getWorkspaceNarrative(workspace)}</p>
            </div>

            {trainingContextHelper ? (
              <p className="max-w-md text-sm leading-6 text-muted-foreground lg:text-right">
                Base actual: {trainingContextHelper}
              </p>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {workspace.draftRoutine ? (
            <RoutineStagePanel
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
              actions={
                <>
                  <Button asChild>
                    <Link href={draftHref}>Ver borrador</Link>
                  </Button>
                  <Button variant="outline" onClick={handleApprove} disabled={isApproving}>
                    {isApproving ? "Aprobando..." : "Aprobar y activar"}
                  </Button>
                </>
              }
            />
          ) : null}

          {workspace.draftRoutine && workspace.activeRoutine ? <div className="border-t border-dashed" /> : null}

          {workspace.activeRoutine ? (
            <RoutineStagePanel
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
              actions={
                <>
                  <Button asChild variant="secondary">
                    <Link href={activeHref}>Abrir rutina activa</Link>
                  </Button>
                  <Button variant="ghost" onClick={handleArchiveActive} disabled={isArchiving}>
                    {isArchiving ? "Archivando..." : "Archivar rutina"}
                  </Button>
                </>
              }
            />
          ) : null}

          {!workspace.draftRoutine && !workspace.activeRoutine ? (
            <section className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6">
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
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
