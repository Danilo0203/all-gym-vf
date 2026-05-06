"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

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

function getContextChips(workspace: CustomerRoutineWorkspace) {
  const profile = workspace.trainingProfile;
  const locationLabel = profile?.training_location
    ? TRAINING_LOCATION_OPTIONS.find((item) => item.value === profile.training_location)?.label
    : null;

  const chips: { label: string; value: string }[] = [];
  if (profile?.primary_goal) {
    const goalLabel = getPrimaryGoalLabel(profile.primary_goal);
    chips.push({ label: "Objetivo", value: goalLabel ?? "—" });
  }
  if (profile?.days_per_week) chips.push({ label: "Frecuencia", value: `${profile.days_per_week} días/sem` });
  if (profile?.session_minutes) {
    const duration = formatSessionDuration(profile.session_minutes);
    if (duration) chips.push({ label: "Duración", value: duration });
  }
  if (locationLabel) chips.push({ label: "Lugar", value: locationLabel });
  return chips;
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

function getGenerateLabel(workspace: CustomerRoutineWorkspace) {
  return workspace.draftRoutine || workspace.activeRoutine || workspace.pendingRoutine
    ? "Generar nueva propuesta"
    : "Generar propuesta";
}

function RoutineCard({
  tone,
  eyebrow,
  title,
  routine,
  details,
  description,
  timestampLabel,
  href,
  actionLabel,
}: {
  tone: "draft" | "active";
  eyebrow: string;
  title: string;
  routine: RoutineRecord;
  details: RoutineDetailRecord[];
  description: string;
  timestampLabel: string;
  href: string;
  actionLabel: string;
}) {
  const timestamp = formatRoutineTimestamp(
    tone === "active" ? routine.reviewed_at || routine.created_at : routine.created_at,
  );
  const primaryGoalLabel = getPrimaryGoalLabel(routine.primary_goal);

  const isDraft = tone === "draft";
  const accentClasses = isDraft
    ? "before:bg-amber-500"
    : "before:bg-emerald-500";
  const iconClasses = isDraft
    ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
    : "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20";
  const eyebrowClasses = isDraft ? "text-amber-400" : "text-emerald-400";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 transition-all hover:border-border hover:bg-card/80",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        accentClasses,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4 min-w-0 flex-1">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", iconClasses)}>
            {isDraft ? <ClipboardList className="size-5" /> : <CheckCircle2 className="size-5" />}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("text-[10px] font-bold uppercase tracking-[0.18em]", eyebrowClasses)}>
                {eyebrow}
              </span>
              <span className="text-muted-foreground/50">•</span>
              <Badge variant={getStatusBadgeVariant(routine.status)} className="h-5 text-[10px] uppercase tracking-wider">
                {getStatusLabel(routine.status)}
              </Badge>
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
              <p className="mt-0.5 text-sm font-medium text-muted-foreground">{routine.name}</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground/80 max-w-xl">{description}</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-semibold text-foreground">{getRoutineDayCount(details)}</span>
                <span>días</span>
              </span>
              <span className="h-3 w-px bg-border/60" />
              <span className="inline-flex items-center gap-1.5">
                <span className="font-semibold text-foreground">{getRoutineExerciseCount(details)}</span>
                <span>ejercicios</span>
              </span>
              {primaryGoalLabel ? (
                <>
                  <span className="h-3 w-px bg-border/60" />
                  <span className="inline-flex items-center gap-1.5">
                    <span>Objetivo:</span>
                    <span className="font-semibold text-foreground">{primaryGoalLabel}</span>
                  </span>
                </>
              ) : null}
              {timestamp ? (
                <>
                  <span className="h-3 w-px bg-border/60" />
                  <span className="text-muted-foreground/70">
                    {timestampLabel} {timestamp}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 lg:self-center">
          <Button asChild variant="outline" size="sm" className="gap-1.5 group/btn">
            <Link href={href}>
              {actionLabel}
              <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
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
  const contextChips = getContextChips(workspace);
  const draftHref = `/panel/clientes/${customerId}/rutina/borrador`;
  const activeHref = `/panel/clientes/${customerId}/rutina/activa`;
  const canGenerate = workspace.missingRequirements.length === 0;
  const generateLabel = getGenerateLabel(workspace);
  const hasRoutines = Boolean(workspace.draftRoutine || workspace.activeRoutine);

  return (
    <div className="space-y-4">
      {/* Hero Section: Context + Next Step */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/10">
        {/* Decorative gradient */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
          {/* Left: Context & Narrative */}
          <div className="space-y-5 p-5 sm:p-6 lg:border-r border-border/40">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Dumbbell className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Contexto de entrenamiento
                </p>
                <h2 className="text-base font-semibold tracking-tight text-foreground mt-0.5">
                  Ficha del cliente
                </h2>
              </div>
            </div>

            {contextChips.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {contextChips.map((chip) => (
                  <div
                    key={chip.label}
                    className="rounded-lg border border-border/40 bg-background/40 px-3 py-2"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {chip.label}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground truncate">{chip.value}</p>
                  </div>
                ))}
              </div>
            ) : trainingContextHelper ? (
              <p className="text-sm leading-6 text-muted-foreground">{trainingContextHelper}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Aún no hay suficiente contexto de entrenamiento para resumir la ficha.
              </p>
            )}

            {workspace.missingRequirements.length > 0 ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                <div className="flex gap-2.5">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <div className="space-y-2 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Faltan datos para personalizar la rutina
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {workspace.missingRequirements.map((item) => (
                        <Badge
                          key={item}
                          variant="outline"
                          className="h-5 border-amber-500/30 bg-background/50 text-[10px] font-medium text-amber-300"
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

          {/* Right: Next Step Action */}
          <div className="relative space-y-4 bg-muted/10 p-5 sm:p-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="size-3" />
                Siguiente paso
              </div>
              <h3 className="text-base font-semibold tracking-tight text-foreground leading-snug">
                {getNextStepTitle(workspace)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {getNextStepDescription(workspace)}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {workspace.draftRoutine ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm" className="flex-1 gap-1.5">
                      <Link href={draftHref}>
                        Revisar borrador
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="flex-1"
                    >
                      <CheckCircle2 className="size-3.5" />
                      {isApproving ? "Aprobando..." : "Aprobar"}
                    </Button>
                  </div>
                  {canGenerate ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="h-8 justify-center text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={cn("size-3", isGenerating && "animate-spin")} />
                      {isGenerating ? "Generando..." : "Generar otra propuesta"}
                    </Button>
                  ) : null}
                </>
              ) : workspace.activeRoutine ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm" variant="secondary" className="flex-1 gap-1.5">
                      <Link href={activeHref}>
                        Abrir activa
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleGenerate}
                      disabled={!canGenerate || isGenerating}
                      className="flex-1"
                    >
                      <RefreshCw className={cn("size-3.5", isGenerating && "animate-spin")} />
                      {isGenerating ? "Generando..." : generateLabel}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleArchiveActive}
                    disabled={isArchiving}
                    className="h-8 justify-center text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isArchiving ? "Archivando..." : "Archivar rutina"}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn("size-3.5", isGenerating && "animate-spin")} />
                  {isGenerating ? "Generando..." : generateLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Routines Section */}
      {hasRoutines ? (
        <div className="space-y-3">
          {workspace.draftRoutine ? (
            <RoutineCard
              tone="draft"
              eyebrow="Borrador"
              title="Listo para revisión"
              routine={workspace.draftRoutine}
              details={workspace.draftDetails}
              description={
                workspace.activeRoutine
                  ? "Revísalo antes de reemplazar la rutina que hoy sigue activa para el cliente."
                  : "Revísalo y actívalo cuando quieras publicarlo para el cliente."
              }
              timestampLabel="Generado"
              href={draftHref}
              actionLabel="Ver borrador"
            />
          ) : null}

          {workspace.activeRoutine ? (
            <RoutineCard
              tone="active"
              eyebrow="Rutina activa"
              title="Versión visible para el cliente"
              routine={workspace.activeRoutine}
              details={workspace.activeDetails}
              description={
                workspace.draftRoutine
                  ? "Sigue siendo la versión publicada hasta que apruebes el borrador."
                  : "Es la versión vigente y se mantiene en solo lectura para preservar trazabilidad."
              }
              timestampLabel="Activa"
              href={activeHref}
              actionLabel="Ver rutina"
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/5 p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/30 mb-3">
            <Dumbbell className="size-6 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold tracking-tight">
            {workspace.pendingRoutine || workspace.missingRequirements.length > 0
              ? "La rutina sigue en espera"
              : "Todavía no hay una rutina generada"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            {workspace.pendingRoutine || workspace.missingRequirements.length > 0
              ? "Completa la ficha del cliente y después genera una propuesta para desbloquear el flujo."
              : "Cuando generes una propuesta aparecerá aquí lista para revisión y activación."}
          </p>
        </div>
      )}
    </div>
  );
}
