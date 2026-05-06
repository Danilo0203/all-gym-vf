"use client";

import { useState } from "react";
import {
  IconBarbell,
  IconBolt,
  IconClockHour4,
  IconFlame,
  IconNotes,
  IconTargetArrow,
} from "@tabler/icons-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRIMARY_GOAL_OPTIONS } from "@/lib/training/options";
import { formatSessionDuration } from "@/lib/training/profile-defaults";
import type { RoutineDetailRecord, RoutineRecord, TrainingProfileRecord } from "@/lib/training/types";

export interface DetailEditorState {
  sets: string;
  reps: string;
  rest_seconds: string;
  duration_minutes: string;
  target_rir: string;
  notes: string;
}

export function getStatusBadgeVariant(status: RoutineRecord["status"] | "complete" | "pending") {
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

export function getStatusLabel(status: RoutineRecord["status"] | "complete" | "pending") {
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

function hasUsableExerciseMedia(detail: RoutineDetailRecord) {
  return Boolean(detail.exercise_image_url);
}

function groupDetailsByDay(details: RoutineDetailRecord[]) {
  return details.reduce<Record<number, RoutineDetailRecord[]>>((accumulator, detail) => {
    accumulator[detail.day_of_week] = accumulator[detail.day_of_week] || [];
    accumulator[detail.day_of_week].push(detail);
    return accumulator;
  }, {});
}

export function getPrimaryGoalLabel(value: string | null | undefined) {
  if (!value) return null;

  const option = PRIMARY_GOAL_OPTIONS.find((item) => item.value === value);
  return option?.label ?? value;
}

export function buildEditorState(detail: RoutineDetailRecord): DetailEditorState {
  return {
    sets: detail.sets?.toString() || "",
    reps: detail.reps || "",
    rest_seconds: detail.rest_seconds?.toString() || "",
    duration_minutes: detail.duration_minutes?.toString() || "",
    target_rir: detail.target_rir?.toString() || "",
    notes: detail.notes || "",
  };
}

export function buildTrainingContextHelper(trainingProfile: TrainingProfileRecord | null) {
  return [
    trainingProfile?.primary_goal ? `Objetivo: ${getPrimaryGoalLabel(trainingProfile.primary_goal)}` : null,
    trainingProfile?.days_per_week ? `${trainingProfile.days_per_week} días/semana` : null,
    trainingProfile?.session_minutes ? `${formatSessionDuration(trainingProfile.session_minutes)} por sesión` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

export function getRoutineDayCount(details: RoutineDetailRecord[]) {
  return new Set(details.map((detail) => detail.day_of_week)).size;
}

export function getRoutineExerciseCount(details: RoutineDetailRecord[]) {
  return details.length;
}

export function RoutineSummaryCard({ title, value, helper }: { title: string; value: string; helper?: string }) {
  return (
    <Card className="border-border/70 bg-card/70 shadow-sm backdrop-blur-sm">
      <CardContent className="space-y-3 p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
        <div className="space-y-1.5">
          <p className="text-base font-semibold leading-tight text-foreground">{value}</p>
          {helper ? <p className="text-sm leading-relaxed text-muted-foreground">{helper}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function RoutineViewer({
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
  const defaultOpenDays = days.length > 0 ? [`day-${days[0]}`] : [];
  const primaryGoalLabel = getPrimaryGoalLabel(routine.primary_goal);

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-4 border-b border-border/60 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
          <Badge variant={getStatusBadgeVariant(routine.status)}>{getStatusLabel(routine.status)}</Badge>
          {primaryGoalLabel ? <Badge variant="outline">{primaryGoalLabel}</Badge> : null}
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {editable
            ? "Puedes ajustar prescripción, descanso, notas y reemplazar ejercicios antes de aprobar."
            : "La rutina activa se muestra en solo lectura para mantener trazabilidad."}
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <IconBarbell className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Ejercicios</span>
            </div>
            <p className="text-2xl font-semibold">{details.length}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <IconBolt className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Bloques</span>
            </div>
            <p className="text-2xl font-semibold">{new Set(details.map((detail) => detail.block_type)).size}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <IconTargetArrow className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Días</span>
            </div>
            <p className="text-2xl font-semibold">{days.length}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <IconFlame className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Objetivo</span>
            </div>
            <p className="text-sm font-semibold leading-snug">{primaryGoalLabel || "Sin objetivo definido"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {days.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Esta rutina todavía no tiene ejercicios asignados.
          </div>
        ) : null}

        {days.length > 0 ? (
          <Accordion type="multiple" defaultValue={defaultOpenDays} className="space-y-4">
            {days.map((day) => (
              <AccordionItem
                key={day}
                value={`day-${day}`}
                className="overflow-hidden rounded-2xl border border-border/70 bg-background/40 px-0 shadow-sm"
              >
                <AccordionTrigger className="px-5 py-5 hover:bg-muted/20 hover:no-underline">
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-2 text-left">
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold uppercase tracking-[0.18em] text-foreground/90">
                        Día {day}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {editable
                          ? "Expande este día para revisar o ajustar ejercicios."
                          : "Expande este día para ver el detalle."}
                      </p>
                    </div>
                    <Badge variant="secondary">{grouped[day].length} ejercicios</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="space-y-3">
                    {grouped[day].map((detail) => {
                      const editor = editors[detail.id] || buildEditorState(detail);
                      const isBusy = busyDetailId === detail.id;

                      return (
                        <div
                          key={detail.id}
                          className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm transition-colors hover:border-border"
                        >
                          <div className="flex flex-col gap-4 xl:flex-row">
                            <ExerciseMediaPreview detail={detail} />

                            <div className="flex-1 space-y-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{getBlockLabel(detail.block_type)}</Badge>
                                    {detail.exercise_order ? (
                                      <Badge variant="secondary">#{detail.exercise_order}</Badge>
                                    ) : null}
                                    {hasUsableExerciseMedia(detail) ? (
                                      <Badge variant="secondary">Demo visual</Badge>
                                    ) : null}
                                  </div>
                                  <div>
                                    <p className="text-lg font-semibold leading-tight">
                                      {detail.exercise_name_snapshot || "Ejercicio por definir"}
                                    </p>
                                    {detail.notes && !editable ? (
                                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                                        <IconNotes className="mt-0.5 h-4 w-4 shrink-0" />
                                        <p>{detail.notes}</p>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {hasUsableExerciseMedia(detail) ? (
                                    <Button asChild variant="ghost" size="sm">
                                      <a
                                        href={detail.exercise_video_url || detail.exercise_image_url || "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Ver demo
                                      </a>
                                    </Button>
                                  ) : null}
                                  {editable ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onReplace(detail)}
                                      disabled={isBusy}
                                    >
                                      Reemplazar ejercicio
                                    </Button>
                                  ) : null}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
                                <ExerciseMetric
                                  icon={<IconBarbell className="h-4 w-4" />}
                                  label="Series"
                                  value={detail.sets?.toString() || "-"}
                                />
                                <ExerciseMetric
                                  icon={<IconTargetArrow className="h-4 w-4" />}
                                  label="Reps"
                                  value={detail.reps || "-"}
                                />
                                <ExerciseMetric
                                  icon={<IconClockHour4 className="h-4 w-4" />}
                                  label="Descanso"
                                  value={detail.rest_seconds ? `${detail.rest_seconds}s` : "-"}
                                />
                                <ExerciseMetric
                                  icon={<IconBolt className="h-4 w-4" />}
                                  label="Duración"
                                  value={detail.duration_minutes ? `${detail.duration_minutes} min` : "-"}
                                />
                                <ExerciseMetric
                                  icon={<IconFlame className="h-4 w-4" />}
                                  label="RIR"
                                  value={detail.target_rir?.toString() || "-"}
                                />
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
                                        onChange={(event) =>
                                          onEditorChange(detail.id, { rest_seconds: event.target.value })
                                        }
                                        inputMode="numeric"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs text-muted-foreground">Duración (min)</label>
                                      <Input
                                        value={editor.duration_minutes}
                                        onChange={(event) =>
                                          onEditorChange(detail.id, { duration_minutes: event.target.value })
                                        }
                                        inputMode="numeric"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs text-muted-foreground">RIR objetivo</label>
                                      <Input
                                        value={editor.target_rir}
                                        onChange={(event) =>
                                          onEditorChange(detail.id, { target_rir: event.target.value })
                                        }
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ExerciseMediaPreview({ detail }: { detail: RoutineDetailRecord }) {
  const title = detail.exercise_name_snapshot || "Ejercicio por definir";
  const [hasMediaError, setHasMediaError] = useState(false);
  const mediaUrl = detail.exercise_image_url;
  const canRenderMedia = Boolean(mediaUrl) && !hasMediaError;

  return (
    <div className="shrink-0 xl:w-64">
      {canRenderMedia ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20 shadow-sm">
          <div className="relative aspect-[4/3] my-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]">
            {/* GIF demos are rendered directly to preserve animation and avoid provider optimization issues. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl!}
              alt={`Demostración visual de ${title}`}
              loading="lazy"
              className="h-full w-full object-contain bg-black/30 p-2"
              onError={() => setHasMediaError(true)}
            />
          </div>
        </div>
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 px-4 text-center">
          <p className="text-sm font-medium">Demo visual no disponible</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasMediaError
              ? "No pudimos cargar la imagen de este ejercicio con la fuente actual."
              : "Este ejercicio aún no tiene imagen o gif asociado en el catálogo."}
          </p>
        </div>
      )}
    </div>
  );
}

function ExerciseMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="text-sm font-semibold leading-tight">{value}</p>
    </div>
  );
}
