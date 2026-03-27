"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type {
  CustomerRoutineWorkspace,
  ExerciseCatalogItem,
  ProviderExerciseSummary,
  RoutineDetailRecord,
  RoutineRecord,
} from "@/lib/training/types";
import {
  approveRoutineDraft,
  archiveRoutine,
  generateRoutineProposal,
  importExerciseFromProvider,
  replaceRoutineExercise,
  searchExerciseCatalog,
  searchExerciseProvider,
  updateRoutineDetail,
} from "@/features/customers/actions/customer-routine-actions";

interface RoutineWorkspaceTabProps {
  customerId: string;
  workspace: CustomerRoutineWorkspace;
}

interface DetailEditorState {
  sets: string;
  reps: string;
  rest_seconds: string;
  duration_minutes: string;
  target_rir: string;
  notes: string;
}

function getStatusBadgeVariant(status: RoutineRecord["status"] | "complete" | "pending") {
  switch (status) {
    case "active":
    case "complete":
      return "success";
    case "draft":
      return "warning";
    case "pending_profile":
    case "pending":
      return "secondary";
    case "archived":
      return "outline";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: RoutineRecord["status"] | "complete" | "pending") {
  switch (status) {
    case "active":
      return "Activa";
    case "draft":
      return "Borrador";
    case "pending_profile":
      return "Pendiente de perfil";
    case "archived":
      return "Archivada";
    case "complete":
      return "Completo";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
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
      return blockType;
  }
}

function groupDetailsByDay(details: RoutineDetailRecord[]) {
  return details.reduce<Record<number, RoutineDetailRecord[]>>((accumulator, detail) => {
    accumulator[detail.day_of_week] = accumulator[detail.day_of_week] || [];
    accumulator[detail.day_of_week].push(detail);
    return accumulator;
  }, {});
}

function buildEditorState(detail: RoutineDetailRecord): DetailEditorState {
  return {
    sets: detail.sets?.toString() || "",
    reps: detail.reps || "",
    rest_seconds: detail.rest_seconds?.toString() || "",
    duration_minutes: detail.duration_minutes?.toString() || "",
    target_rir: detail.target_rir?.toString() || "",
    notes: detail.notes || "",
  };
}

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

function RoutineSummaryCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-4 space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="text-sm font-semibold">{value}</p>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

function RoutineViewer({
  title,
  routine,
  details,
  editable,
  editors,
  onEditorChange,
  onSave,
  onReplace,
  busyDetailId,
}: {
  title: string;
  routine: RoutineRecord;
  details: RoutineDetailRecord[];
  editable: boolean;
  editors: Record<number, DetailEditorState>;
  onEditorChange: (detailId: number, patch: Partial<DetailEditorState>) => void;
  onSave: (detailId: number) => Promise<void>;
  onReplace: (detail: RoutineDetailRecord) => void;
  busyDetailId: number | null;
}) {
  const grouped = groupDetailsByDay(details);
  const days = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant={getStatusBadgeVariant(routine.status)}>{getStatusLabel(routine.status)}</Badge>
          {routine.primary_goal ? <Badge variant="outline">{routine.primary_goal}</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {editable
            ? "Puedes ajustar prescripción, descanso, notas y reemplazar ejercicios antes de aprobar."
            : "La rutina activa se muestra en solo lectura para mantener trazabilidad."}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {days.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Esta rutina todavía no tiene ejercicios asignados.
          </div>
        ) : null}

        {days.map((day) => (
          <div key={day} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Día {day}</h4>
              <Badge variant="secondary">{grouped[day].length} ejercicios</Badge>
            </div>
            <div className="space-y-3">
              {grouped[day].map((detail) => {
                const editor = editors[detail.id] || buildEditorState(detail);
                const isBusy = busyDetailId === detail.id;

                return (
                  <div key={detail.id} className="rounded-lg border p-4 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{getBlockLabel(detail.block_type)}</Badge>
                          {detail.exercise_order ? <Badge variant="secondary">#{detail.exercise_order}</Badge> : null}
                        </div>
                        <div>
                          <p className="font-semibold">{detail.exercise_name_snapshot || "Ejercicio por definir"}</p>
                          {detail.notes && !editable ? (
                            <p className="text-sm text-muted-foreground mt-1">{detail.notes}</p>
                          ) : null}
                        </div>
                      </div>
                      {editable ? (
                        <Button variant="outline" size="sm" onClick={() => onReplace(detail)} disabled={isBusy}>
                          Reemplazar ejercicio
                        </Button>
                      ) : null}
                    </div>

                    {editable ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Series</label>
                            <Input
                              value={editor.sets}
                              onChange={(event) => onEditorChange(detail.id, { sets: event.target.value })}
                              inputMode="numeric"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Reps</label>
                            <Input
                              value={editor.reps}
                              onChange={(event) => onEditorChange(detail.id, { reps: event.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Descanso (seg)</label>
                            <Input
                              value={editor.rest_seconds}
                              onChange={(event) => onEditorChange(detail.id, { rest_seconds: event.target.value })}
                              inputMode="numeric"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Duración (min)</label>
                            <Input
                              value={editor.duration_minutes}
                              onChange={(event) => onEditorChange(detail.id, { duration_minutes: event.target.value })}
                              inputMode="numeric"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">RIR objetivo</label>
                            <Input
                              value={editor.target_rir}
                              onChange={(event) => onEditorChange(detail.id, { target_rir: event.target.value })}
                              inputMode="decimal"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Notas</label>
                          <Textarea
                            value={editor.notes}
                            onChange={(event) => onEditorChange(detail.id, { notes: event.target.value })}
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => onSave(detail.id)} disabled={isBusy}>
                            {isBusy ? "Guardando..." : "Guardar ajuste"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RoutineWorkspaceTab({ customerId, workspace }: RoutineWorkspaceTabProps) {
  const router = useRouter();
  const [editors, setEditors] = useState<Record<number, DetailEditorState>>({});
  const [busyDetailId, setBusyDetailId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<RoutineDetailRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [localResults, setLocalResults] = useState<ExerciseCatalogItem[]>([]);
  const [providerResults, setProviderResults] = useState<ProviderExerciseSummary[]>([]);
  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
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

  const openReplaceDialog = (detail: RoutineDetailRecord) => {
    setReplaceTarget(detail);
    setSearchTerm(detail.exercise_name_snapshot || "");
    setLocalResults([]);
    setProviderResults([]);
  };

  const handleLocalSearch = async () => {
    if (!searchTerm.trim()) {
      setLocalResults([]);
      return;
    }

    try {
      setIsSearchingLocal(true);
      const result = await searchExerciseCatalog({ query: searchTerm, limit: 12 });
      setLocalResults(result.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo buscar en el catálogo local.");
    } finally {
      setIsSearchingLocal(false);
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
      setReplaceTarget(null);
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
      setReplaceTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar el ejercicio.");
    } finally {
      setIsImportingProvider(false);
    }
  };

  const trainingProfile = workspace.trainingProfile;
  const trainingContextHelper = [
    trainingProfile?.primary_goal ? `Objetivo: ${trainingProfile.primary_goal}` : null,
    trainingProfile?.days_per_week ? `${trainingProfile.days_per_week} días/semana` : null,
    trainingProfile?.session_minutes ? `${trainingProfile.session_minutes} min por sesión` : null,
    trainingProfile?.training_location ? `Lugar: ${trainingProfile.training_location}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

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
          helper={workspace.draftRoutine ? workspace.draftRoutine.name : "Genera una propuesta cuando el perfil esté listo."}
        />
        <RoutineSummaryCard
          title="Rutina activa"
          value={workspace.activeRoutine ? "Sí" : "No"}
          helper={workspace.activeRoutine ? workspace.activeRoutine.name : "Aún no hay una rutina aprobada."}
        />
        <RoutineSummaryCard
          title="Datos faltantes"
          value={workspace.missingRequirements.length === 0 ? "Completado" : `${workspace.missingRequirements.length} pendientes`}
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
          <Button
            variant="outline"
            onClick={handleApprove}
            disabled={!workspace.draftRoutine || isApproving}
          >
            {isApproving ? "Aprobando..." : "Aprobar borrador"}
          </Button>
          <Button
            variant="outline"
            onClick={handleArchiveActive}
            disabled={!workspace.activeRoutine || isArchiving}
          >
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
        <RoutineViewer
          title="Propuesta automática en borrador"
          routine={workspace.draftRoutine}
          details={workspace.draftDetails}
          editable
          editors={editors}
          onEditorChange={handleEditorChange}
          onSave={handleSaveDetail}
          onReplace={openReplaceDialog}
          busyDetailId={busyDetailId}
        />
      ) : null}

      {workspace.activeRoutine ? (
        <RoutineViewer
          title="Rutina activa"
          routine={workspace.activeRoutine}
          details={workspace.activeDetails}
          editable={false}
          editors={{}}
          onEditorChange={() => undefined}
          onSave={async () => undefined}
          onReplace={() => undefined}
          busyDetailId={null}
        />
      ) : null}

      <Dialog open={Boolean(replaceTarget)} onOpenChange={(open) => !open && setReplaceTarget(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reemplazar ejercicio</DialogTitle>
            <DialogDescription>
              Busca primero en el catálogo local. Si no encuentras uno adecuado, consulta ExerciseDB e impórtalo al
              momento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar ejercicio..." />
              <Button variant="outline" onClick={handleLocalSearch} disabled={isSearchingLocal}>
                {isSearchingLocal ? "Buscando..." : "Buscar local"}
              </Button>
              <Button variant="outline" onClick={handleProviderSearch} disabled={isSearchingProvider || isImportingProvider}>
                {isSearchingProvider ? "Consultando..." : "Buscar ExerciseDB"}
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Catálogo local</h4>
                  <Badge variant="secondary">{localResults.length}</Badge>
                </div>
                <ScrollArea className="h-72 rounded-lg border">
                  <div className="p-3 space-y-2">
                    {localResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin resultados todavía.</p>
                    ) : null}
                    {localResults.map((exercise) => (
                      <div key={exercise.id} className="rounded-md border p-3 space-y-2">
                        <div>
                          <p className="font-medium">{exercise.display_name_es || exercise.display_name || exercise.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(exercise.target_muscles || []).slice(0, 2).join(", ") || "Sin músculos definidos"}
                          </p>
                        </div>
                        <Button size="sm" className="w-full" onClick={() => handleReplaceWithLocal(exercise.id)}>
                          Usar este ejercicio
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">ExerciseDB</h4>
                  <Badge variant="secondary">{providerResults.length}</Badge>
                </div>
                <ScrollArea className="h-72 rounded-lg border">
                  <div className="p-3 space-y-2">
                    {providerResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Busca aquí solo cuando necesites importar algo que no exista localmente.
                      </p>
                    ) : null}
                    {providerResults.map((exercise) => (
                      <div key={exercise.exerciseId} className="rounded-md border p-3 space-y-2">
                        <div>
                          <p className="font-medium">{exercise.name}</p>
                          <p className="text-xs text-muted-foreground">{exercise.exerciseId}</p>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleReplaceWithProvider(exercise)}
                          disabled={isImportingProvider}
                        >
                          {isImportingProvider ? "Importando..." : "Importar y usar"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
