"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconArrowLeft } from "@tabler/icons-react";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CustomerRoutineWorkspace,
  ExerciseCatalogItem,
  ExerciseReplacementGroup,
  ProviderExerciseSummary,
  RoutineDetailRecord,
  RoutineReplacementContext,
} from "@/lib/training/types";
import {
  approveRoutineDraft,
  getRoutineExerciseReplacementOptions,
  importExerciseFromProvider,
  replaceRoutineExercise,
  searchExerciseCatalog,
  searchExerciseProvider,
  updateRoutineDetail,
} from "@/features/customers/actions/customer-routine-actions";
import {
  buildEditorState,
  buildTrainingContextHelper,
  getRoutineDayCount,
  getRoutineExerciseCount,
  getStatusBadgeVariant,
  getStatusLabel,
  RoutineSummaryCard,
  RoutineViewer,
  type DetailEditorState,
} from "./tabs/routine-workspace-shared";

interface RoutineDraftPageProps {
  customerId: string;
  customerName: string;
  workspace: CustomerRoutineWorkspace;
}

type ReplacementOptionLike = ExerciseCatalogItem | ExerciseReplacementGroup["options"][number];

function toNullableInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableFloat(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RoutineDraftPage({ customerId, customerName, workspace }: RoutineDraftPageProps) {
  const router = useRouter();
  const [editors, setEditors] = useState<Record<number, DetailEditorState>>({});
  const [busyDetailId, setBusyDetailId] = useState<number | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<RoutineDetailRecord | null>(null);
  const replacementRequestRef = useRef<number | null>(null);
  const [replacementContext, setReplacementContext] = useState<RoutineReplacementContext | null>(null);
  const [replacementGroups, setReplacementGroups] = useState<ExerciseReplacementGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [manualResults, setManualResults] = useState<ExerciseCatalogItem[]>([]);
  const [providerResults, setProviderResults] = useState<ProviderExerciseSummary[]>([]);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [showProviderFallback, setShowProviderFallback] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [isSearchingProvider, setIsSearchingProvider] = useState(false);
  const [isImportingProvider, setIsImportingProvider] = useState(false);

  useEffect(() => {
    const nextEditors: Record<number, DetailEditorState> = {};
    for (const detail of workspace.draftDetails) {
      nextEditors[detail.id] = buildEditorState(detail);
    }
    setEditors(nextEditors);
  }, [workspace.draftDetails]);

  const handleEditorChange = (detailId: number, patch: Partial<DetailEditorState>) => {
    setEditors((current) => ({
      ...current,
      [detailId]: {
        ...(current[detailId] || buildEditorState(workspace.draftDetails.find((detail) => detail.id === detailId)!)),
        ...patch,
      },
    }));
  };

  const handleSaveDetail = async (detailId: number) => {
    const editor = editors[detailId];
    if (!editor) return;

    try {
      setBusyDetailId(detailId);
      await updateRoutineDetail(detailId, {
        sets: toNullableInt(editor.sets),
        reps: editor.reps.trim() || null,
        rest_seconds: toNullableInt(editor.rest_seconds),
        duration_minutes: toNullableInt(editor.duration_minutes),
        target_rir: toNullableFloat(editor.target_rir),
        notes: editor.notes.trim() || null,
      });
      toast.success("Ajuste guardado en el borrador.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el ajuste.");
    } finally {
      setBusyDetailId(null);
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

  const closeReplaceDialog = () => {
    replacementRequestRef.current = null;
    setReplaceTarget(null);
    setReplacementContext(null);
    setReplacementGroups([]);
    setShowManualSearch(false);
    setShowProviderFallback(false);
    setIsLoadingSuggestions(false);
    setIsSearchingManual(false);
    setIsSearchingProvider(false);
    setIsImportingProvider(false);
    setManualResults([]);
    setProviderResults([]);
    setSearchTerm("");
  };

  const loadReplacementOptions = async (detail: RoutineDetailRecord) => {
    try {
      setIsLoadingSuggestions(true);
      const result = await getRoutineExerciseReplacementOptions(detail.id);

      if (replacementRequestRef.current !== detail.id) {
        return;
      }

      setReplacementContext(result.data.context);
      setReplacementGroups(result.data.groups);
    } catch (error) {
      if (replacementRequestRef.current === detail.id) {
        setReplacementContext(null);
        setReplacementGroups([]);
      }
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar las sugerencias.");
    } finally {
      if (replacementRequestRef.current === detail.id) {
        setIsLoadingSuggestions(false);
      }
    }
  };

  const openReplaceDialog = (detail: RoutineDetailRecord) => {
    replacementRequestRef.current = detail.id;
    setReplaceTarget(detail);
    setSearchTerm(detail.exercise_name_snapshot || "");
    setReplacementContext(null);
    setReplacementGroups([]);
    setShowManualSearch(false);
    setShowProviderFallback(false);
    setManualResults([]);
    setProviderResults([]);
    void loadReplacementOptions(detail);
  };

  const handleManualSearch = async () => {
    if (!searchTerm.trim()) {
      setManualResults([]);
      return;
    }

    try {
      setIsSearchingManual(true);
      const result = await searchExerciseCatalog({ query: searchTerm, limit: 12 });
      setManualResults(result.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo buscar en el catálogo local.");
    } finally {
      setIsSearchingManual(false);
    }
  };

  const handleProviderSearch = async () => {
    if (!searchTerm.trim()) {
      setProviderResults([]);
      return;
    }

    try {
      setIsSearchingProvider(true);
      const result = await searchExerciseProvider(searchTerm);
      setProviderResults(result.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar ExerciseDB.");
    } finally {
      setIsSearchingProvider(false);
    }
  };

  const handleReplaceWithLocal = async (exerciseId: number) => {
    if (!replaceTarget) return;

    try {
      setBusyDetailId(replaceTarget.id);
      await replaceRoutineExercise(replaceTarget.id, exerciseId);
      toast.success("Ejercicio reemplazado en el borrador.");
      closeReplaceDialog();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reemplazar el ejercicio.");
    } finally {
      setBusyDetailId(null);
    }
  };

  const handleReplaceWithProvider = async (exercise: ProviderExerciseSummary) => {
    if (!replaceTarget) return;

    try {
      setIsImportingProvider(true);
      const imported = await importExerciseFromProvider(exercise as unknown as Record<string, unknown>);
      await replaceRoutineExercise(replaceTarget.id, imported.data.id);
      toast.success("Ejercicio importado desde ExerciseDB y asignado.");
      closeReplaceDialog();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar el ejercicio.");
    } finally {
      setIsImportingProvider(false);
    }
  };

  const backHref = `/panel/clientes/${customerId}/history#routine`;
  const activeHref = `/panel/clientes/${customerId}/rutina/activa`;
  const trainingContextHelper = buildTrainingContextHelper(workspace.trainingProfile);

  if (!workspace.draftRoutine) {
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
              <h1 className="text-2xl font-black tracking-tight">Borrador de rutina</h1>
              <p className="text-sm text-muted-foreground">{customerName}</p>
            </div>
          </div>
        </div>

        <Card className="border-border/70">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-lg font-semibold">Todavía no hay un borrador disponible</p>
            <p className="text-sm text-muted-foreground">
              Genera una propuesta desde la pestaña de rutina del perfil para empezar a trabajar aquí.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link href={backHref}>Volver a Rutina</Link>
              </Button>
              {workspace.activeRoutine ? (
                <Button asChild>
                  <Link href={activeHref}>Ver rutina aprobada</Link>
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
      <div className="flex-1 min-h-0 overflow-y-auto">
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
                    <h1 className="text-2xl font-black tracking-tight">Borrador de rutina</h1>
                    <Badge variant={getStatusBadgeVariant(workspace.draftRoutine.status)}>
                      {getStatusLabel(workspace.draftRoutine.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {customerName} · {workspace.draftRoutine.name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{getRoutineDayCount(workspace.draftDetails)} días</Badge>
                <Badge variant="secondary">{getRoutineExerciseCount(workspace.draftDetails)} ejercicios</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RoutineSummaryCard
              title="Cliente"
              value={customerName}
              helper={workspace.draftRoutine.primary_goal ? `Objetivo: ${workspace.draftRoutine.primary_goal}` : undefined}
            />
            <RoutineSummaryCard
              title="Perfil de entrenamiento"
              value={getStatusLabel(workspace.trainingProfileStatus)}
              helper={trainingContextHelper || "Sin contexto suficiente para resumir."}
            />
            <RoutineSummaryCard
              title="Borrador"
              value={workspace.draftRoutine.name}
              helper={`${getRoutineDayCount(workspace.draftDetails)} días • ${getRoutineExerciseCount(workspace.draftDetails)} ejercicios`}
            />
          </div>

          <RoutineViewer
            title="Editor de borrador"
            routine={workspace.draftRoutine}
            details={workspace.draftDetails}
            editable
            editors={editors}
            onEditorChange={handleEditorChange}
            onSave={handleSaveDetail}
            onReplace={openReplaceDialog}
            busyDetailId={busyDetailId}
          />
        </div>
      </div>

      <div className="border-t bg-background/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Guarda por bloque cuando ajustes series, repeticiones o notas. Aprueba solo cuando el borrador quede listo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={backHref}>Volver al perfil</Link>
            </Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              {isApproving ? "Aprobando..." : "Aprobar borrador"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(replaceTarget)} onOpenChange={(open) => !open && closeReplaceDialog()}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Reemplazar ejercicio</DialogTitle>
            <DialogDescription>
              Primero verás alternativas sugeridas para este bloque. La búsqueda manual queda como respaldo y
              ExerciseDB solo aparece si de verdad necesitas salirte del catálogo local.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(85vh-7.5rem)] pr-4">
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <ReplacementMediaThumb
                    src={replaceTarget?.exercise_image_url || null}
                    alt={replacementContext?.currentExerciseName || replaceTarget?.exercise_name_snapshot || "Ejercicio actual"}
                    className="h-24 w-full sm:w-32"
                  />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">
                        {replacementContext?.currentExerciseName || replaceTarget?.exercise_name_snapshot || "Ejercicio actual"}
                      </p>
                      {replaceTarget ? <Badge variant="outline">{getBlockLabel(replaceTarget.block_type)}</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {replacementContext
                        ? "Estas opciones ya vienen filtradas por bloque, equipo, músculos y restricciones del perfil."
                        : "Cargando alternativas del catálogo local para que el ajuste sea rápido."}
                    </p>
                  </div>
                </div>
              </div>

              {isLoadingSuggestions ? (
                <div className="space-y-4">
                  <ReplacementGroupSkeleton />
                  <ReplacementGroupSkeleton />
                </div>
              ) : replacementGroups.length > 0 ? (
                <div className="space-y-4">
                  {replacementGroups.map((group) => (
                    <ReplacementGroupSection
                      key={group.key}
                      group={group}
                      busy={busyDetailId === replaceTarget?.id}
                      onSelect={handleReplaceWithLocal}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4">
                  <p className="text-sm font-medium">No encontramos sugerencias automáticas para este caso.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Puedes usar la búsqueda manual del catálogo o, si hace falta, consultar ExerciseDB como respaldo.
                  </p>
                </div>
              )}

              <Collapsible open={showManualSearch} onOpenChange={setShowManualSearch}>
                <div className="rounded-xl border border-dashed p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Buscar manualmente</p>
                      <p className="text-sm text-muted-foreground">
                        Usa esta capa solo si quieres salirte de las recomendaciones del sistema.
                      </p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline">
                        {showManualSearch ? "Ocultar búsqueda manual" : "Abrir búsqueda manual"}
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent className="pt-4">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 md:flex-row">
                        <Input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Buscar ejercicio en español..."
                        />
                        <Button variant="outline" onClick={handleManualSearch} disabled={isSearchingManual}>
                          {isSearchingManual ? "Buscando..." : "Buscar en catálogo"}
                        </Button>
                      </div>

                      <ManualSearchSection
                        title="Resultados del catálogo"
                        helper="Primero te mostramos coincidencias del catálogo local ya disponible en español."
                        emptyMessage="Todavía no hay resultados del catálogo local."
                        results={manualResults}
                        busy={busyDetailId === replaceTarget?.id}
                        onSelect={handleReplaceWithLocal}
                      />

                      <div className="rounded-xl border border-dashed p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">Respaldo con ExerciseDB</p>
                            <p className="text-sm text-muted-foreground">
                              Úsalo solo si el catálogo local no te da una alternativa adecuada.
                            </p>
                          </div>
                          <Button variant="ghost" onClick={() => setShowProviderFallback((current) => !current)}>
                            {showProviderFallback ? "Ocultar respaldo" : "Consultar ExerciseDB"}
                          </Button>
                        </div>

                        {showProviderFallback ? (
                          <div className="mt-4 space-y-4">
                            <div className="flex flex-col gap-3 md:flex-row">
                              <Input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Buscar también en ExerciseDB..."
                              />
                              <Button
                                variant="outline"
                                onClick={handleProviderSearch}
                                disabled={isSearchingProvider || isImportingProvider}
                              >
                                {isSearchingProvider ? "Consultando..." : "Buscar en ExerciseDB"}
                              </Button>
                            </div>

                            <ProviderFallbackSection
                              results={providerResults}
                              importing={isImportingProvider}
                              onSelect={handleReplaceWithProvider}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReplacementGroupSection({
  group,
  busy,
  onSelect,
}: {
  group: ExerciseReplacementGroup;
  busy: boolean;
  onSelect: (exerciseId: number) => Promise<void>;
}) {
  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{group.title}</h4>
            <Badge variant="secondary">{group.options.length}</Badge>
          </div>
          {group.description ? <p className="text-sm text-muted-foreground">{group.description}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {group.options.map((option) => (
          <ReplacementOptionCard key={option.id} option={option} busy={busy} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function ReplacementOptionCard({
  option,
  busy,
  onSelect,
}: {
  option: ReplacementOptionLike;
  busy: boolean;
  onSelect: (exerciseId: number) => Promise<void>;
}) {
  const isSuggestedOption = "reason" in option;
  const targetMuscles = isSuggestedOption ? option.targetMuscles : option.target_muscles;
  const equipments = option.equipments;
  const reason = isSuggestedOption ? option.reason : null;
  const displayName = isSuggestedOption ? option.name : option.display_name_es || option.display_name || option.name;
  const mediaUrl = isSuggestedOption ? option.imageUrl : option.image_url;

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <ReplacementMediaThumb src={mediaUrl} alt={displayName} className="h-24 w-28 shrink-0" />
          <div className="min-w-0 space-y-2">
            <p className="font-medium">{displayName}</p>
            {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
            <div className="flex flex-wrap gap-2">
              {targetMuscles.slice(0, 2).map((muscle) => (
                <Badge key={muscle} variant="outline">
                  {muscle}
                </Badge>
              ))}
              {equipments.slice(0, 1).map((equipment) => (
                <Badge key={equipment} variant="secondary">
                  {equipment}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Button size="sm" className="lg:min-w-36" onClick={() => void onSelect(option.id)} disabled={busy}>
          {busy ? "Reemplazando..." : "Usar este ejercicio"}
        </Button>
      </div>
    </div>
  );
}

function ManualSearchSection({
  title,
  helper,
  emptyMessage,
  results,
  busy,
  onSelect,
}: {
  title: string;
  helper: string;
  emptyMessage: string;
  results: ExerciseCatalogItem[];
  busy: boolean;
  onSelect: (exerciseId: number) => Promise<void>;
}) {
  return (
    <section className="rounded-xl border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          <Badge variant="secondary">{results.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{helper}</p>
      </div>

      <div className="mt-4 space-y-3">
        {results.length === 0 ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null}
        {results.map((exercise) => (
          <ReplacementOptionCard key={exercise.id} option={exercise} busy={busy} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function ProviderFallbackSection({
  results,
  importing,
  onSelect,
}: {
  results: ProviderExerciseSummary[];
  importing: boolean;
  onSelect: (exercise: ProviderExerciseSummary) => Promise<void>;
}) {
  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">Resultados de ExerciseDB</h4>
        <Badge variant="secondary">{results.length}</Badge>
      </div>

      <div className="mt-4 space-y-3">
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aquí solo aparecerán opciones cuando necesites importar algo externo.</p>
        ) : null}
        {results.map((exercise) => (
          <div key={exercise.exerciseId} className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 gap-4">
                <ReplacementMediaThumb src={exercise.imageUrl} alt={exercise.name} className="h-24 w-28 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{exercise.name}</p>
                  <p className="text-sm text-muted-foreground">ID externo: {exercise.exerciseId}</p>
                </div>
              </div>
              <Button size="sm" className="lg:min-w-36" onClick={() => void onSelect(exercise)} disabled={importing}>
                {importing ? "Importando..." : "Importar y usar"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReplacementMediaThumb({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const canRender = Boolean(src) && !hasError;

  return (
    <div className={`overflow-hidden rounded-lg border bg-muted/20 ${className || "h-24 w-28"}`}>
      {canRender ? (
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center">
          <ImageIcon className="size-5" />
          <span className="text-[11px]">Sin preview</span>
        </div>
      )}
    </div>
  );
}

function ReplacementGroupSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

function getBlockLabel(blockType: RoutineDetailRecord["block_type"]) {
  switch (blockType) {
    case "warmup":
      return "Calentamiento";
    case "strength":
      return "Fuerza";
    case "accessory":
      return "Accesorio";
    case "cardio":
      return "Cardio";
    case "mobility":
      return "Movilidad";
    default:
      return "Bloque";
  }
}
