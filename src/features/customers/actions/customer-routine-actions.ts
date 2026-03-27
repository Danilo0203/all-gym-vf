/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext } from "@/lib/auth/authorization";
import { normalizeExerciseCatalogItem, mapProviderExerciseToCatalogPayload } from "@/lib/training/catalog";
import { buildRoutineProposal, ROUTINE_ENGINE_VERSION } from "@/lib/training/routine-engine";
import {
  getMissingTrainingProfileRequirements,
  isTrainingProfileComplete,
  normalizeTrainingProfileInput,
} from "@/lib/training/profile";
import type {
  CustomerRoutineWorkspace,
  NutritionContext,
  ProviderExerciseSummary,
  RoutineDetailRecord,
  RoutineRecord,
  RoutineProposal,
  TrainingProfileInput,
  TrainingProfileRecord,
} from "@/lib/training/types";

type AdminSupabaseClient = any;

const EXERCISE_CATALOG_FUNCTION = "exercise-catalog-provider";

function mapTrainingProfileRow(row: Record<string, unknown> | null): TrainingProfileRecord | null {
  if (!row || typeof row.id !== "string" || typeof row.user_id !== "string") return null;

  return {
    id: row.id,
    user_id: row.user_id,
    primary_goal: typeof row.primary_goal === "string" ? (row.primary_goal as TrainingProfileRecord["primary_goal"]) : null,
    secondary_goal:
      typeof row.secondary_goal === "string" ? (row.secondary_goal as TrainingProfileRecord["secondary_goal"]) : null,
    focus_areas: Array.isArray(row.focus_areas) ? (row.focus_areas as TrainingProfileRecord["focus_areas"]) : [],
    experience_level:
      typeof row.experience_level === "string"
        ? (row.experience_level as TrainingProfileRecord["experience_level"])
        : null,
    days_per_week: typeof row.days_per_week === "number" ? row.days_per_week : null,
    session_minutes: typeof row.session_minutes === "number" ? row.session_minutes : null,
    training_location:
      typeof row.training_location === "string"
        ? (row.training_location as TrainingProfileRecord["training_location"])
        : null,
    equipment_available: Array.isArray(row.equipment_available)
      ? (row.equipment_available as TrainingProfileRecord["equipment_available"])
      : [],
    activity_level:
      typeof row.activity_level === "string" ? (row.activity_level as TrainingProfileRecord["activity_level"]) : null,
    cardio_preference:
      typeof row.cardio_preference === "string"
        ? (row.cardio_preference as TrainingProfileRecord["cardio_preference"])
        : null,
    exercise_preferences: typeof row.exercise_preferences === "string" ? row.exercise_preferences : null,
    exercise_dislikes: typeof row.exercise_dislikes === "string" ? row.exercise_dislikes : null,
    injuries_or_pain: typeof row.injuries_or_pain === "string" ? row.injuries_or_pain : null,
    restricted_movements: Array.isArray(row.restricted_movements)
      ? (row.restricted_movements as TrainingProfileRecord["restricted_movements"])
      : [],
    parq_requires_attention: typeof row.parq_requires_attention === "boolean" ? row.parq_requires_attention : null,
    medical_clearance_notes: typeof row.medical_clearance_notes === "string" ? row.medical_clearance_notes : null,
    is_complete: row.is_complete === true,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}

function mapRoutineRow(row: Record<string, unknown>): RoutineRecord {
  return {
    id: String(row.id),
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    name: String(row.name || "Rutina"),
    start_date: typeof row.start_date === "string" ? row.start_date : null,
    end_date: typeof row.end_date === "string" ? row.end_date : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : null,
    goal: typeof row.goal === "string" ? row.goal : null,
    status: String(row.status || "draft") as RoutineRecord["status"],
    source: String(row.source || "system") as RoutineRecord["source"],
    training_profile_id: typeof row.training_profile_id === "string" ? row.training_profile_id : null,
    primary_goal: typeof row.primary_goal === "string" ? row.primary_goal : null,
    secondary_goal: typeof row.secondary_goal === "string" ? row.secondary_goal : null,
    generation_version: typeof row.generation_version === "string" ? row.generation_version : null,
    reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function mapRoutineDetailRow(row: Record<string, unknown>): RoutineDetailRecord {
  return {
    id: Number(row.id),
    routine_id: String(row.routine_id),
    day_of_week: Number(row.day_of_week || 0),
    exercise_id: typeof row.exercise_id === "number" ? row.exercise_id : null,
    exercise_order: typeof row.exercise_order === "number" ? row.exercise_order : null,
    block_type: String(row.block_type || "strength") as RoutineDetailRecord["block_type"],
    sets: typeof row.sets === "number" ? row.sets : null,
    reps: typeof row.reps === "string" ? row.reps : null,
    rest_seconds: typeof row.rest_seconds === "number" ? row.rest_seconds : null,
    duration_minutes: typeof row.duration_minutes === "number" ? row.duration_minutes : null,
    target_rir: typeof row.target_rir === "number" ? row.target_rir : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    exercise_name_snapshot: typeof row.exercise_name_snapshot === "string" ? row.exercise_name_snapshot : null,
  };
}

async function requireAdminAccess() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.isAdmin || !access.userId) {
    throw new Error("No autorizado");
  }

  return {
    access,
    adminClient: createAdminClient(),
  };
}

async function getNutritionContextForUser(adminClient: AdminSupabaseClient, userId: string): Promise<NutritionContext> {
  const [{ data: profile }, { data: assessment }] = await Promise.all([
    adminClient.from("profiles").select("birth_date, gender").eq("id", userId).maybeSingle(),
    adminClient
      .from("body_assessments")
      .select("weight_kg, height_cm, body_type, diet_type, activity_level")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    birthDate: profile?.birth_date ? new Date(profile.birth_date) : null,
    gender: profile?.gender || null,
    weightKg: typeof assessment?.weight_kg === "number" ? assessment.weight_kg : null,
    heightCm: typeof assessment?.height_cm === "number" ? assessment.height_cm : null,
    bodyType: assessment?.body_type || null,
    dietType: assessment?.diet_type || null,
    activityLevel: assessment?.activity_level || null,
  };
}

async function listExerciseCatalog(adminClient: AdminSupabaseClient) {
  const { data, error } = await adminClient
    .from("exercises")
    .select(
      "id, slug, name, display_name, display_name_es, provider, provider_item_id, body_parts, target_muscles, secondary_muscles, equipments, exercise_type, instructions, tips, keywords, variations, image_url, video_url, description, raw_payload, last_synced_at, is_active",
    )
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => normalizeExerciseCatalogItem(row));
}

async function archiveDraftsAndPending(adminClient: AdminSupabaseClient, userId: string) {
  const { error } = await adminClient
    .from("routines")
    .update({ status: "archived", is_active: false })
    .eq("user_id", userId)
    .in("status", ["draft", "pending_profile"]);

  if (error) throw error;
}

async function ensurePendingRoutine(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  createdBy: string;
  trainingProfileId?: string | null;
  primaryGoal?: string | null;
  secondaryGoal?: string | null;
}) {
  const { adminClient, userId, createdBy, trainingProfileId, primaryGoal, secondaryGoal } = params;

  const { data: existing } = await adminClient
    .from("routines")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending_profile")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await adminClient
      .from("routines")
      .update({
        training_profile_id: trainingProfileId ?? null,
        primary_goal: primaryGoal ?? null,
        secondary_goal: secondaryGoal ?? null,
        generation_version: ROUTINE_ENGINE_VERSION,
      })
      .eq("id", existing.id);

    return existing.id;
  }

  const { data: pendingRoutine, error } = await adminClient
    .from("routines")
    .insert({
      user_id: userId,
      created_by: createdBy,
      name: "Rutina pendiente de perfil",
      is_active: false,
      goal: "Pendiente de perfil",
      status: "pending_profile",
      source: "system",
      training_profile_id: trainingProfileId ?? null,
      primary_goal: primaryGoal ?? null,
      secondary_goal: secondaryGoal ?? null,
      generation_version: ROUTINE_ENGINE_VERSION,
    })
    .select("id")
    .single();

  if (error) throw error;
  return pendingRoutine.id;
}

async function persistRoutineDraft(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  createdBy: string;
  trainingProfileId: string;
  proposal: RoutineProposal;
  primaryGoal: string | null;
  secondaryGoal: string | null;
}) {
  const { adminClient, userId, createdBy, trainingProfileId, proposal, primaryGoal, secondaryGoal } = params;

  await archiveDraftsAndPending(adminClient, userId);

  const { data: routine, error: routineError } = await adminClient
    .from("routines")
    .insert({
      user_id: userId,
      created_by: createdBy,
      name: `Propuesta ${primaryGoal || "personalizada"}`,
      is_active: false,
      goal: primaryGoal || "Personalizada",
      status: "draft",
      source: "system",
      training_profile_id: trainingProfileId,
      primary_goal: primaryGoal,
      secondary_goal: secondaryGoal,
      generation_version: ROUTINE_ENGINE_VERSION,
    })
    .select("id")
    .single();

  if (routineError || !routine) throw routineError || new Error("No se pudo crear la rutina");

  const detailRows = proposal.days.flatMap((day) =>
    day.exercises.map((exercise) => ({
      routine_id: routine.id,
      day_of_week: day.dayIndex,
      exercise_id: exercise.exerciseId,
      exercise_order: exercise.exerciseOrder,
      block_type: exercise.blockType,
      sets: exercise.sets,
      reps: exercise.reps,
      rest_seconds: exercise.restSeconds,
      duration_minutes: exercise.durationMinutes,
      target_rir: exercise.targetRir,
      notes: exercise.requiresReview ? exercise.reason || "Requiere revisión" : null,
      exercise_name_snapshot: exercise.exerciseName,
    })),
  );

  if (detailRows.length > 0) {
    const { error: detailsError } = await adminClient.from("routine_details").insert(detailRows);
    if (detailsError) throw detailsError;
  }

  return routine.id;
}

async function fetchTrainingProfileInternal(adminClient: AdminSupabaseClient, userId: string) {
  const { data, error } = await adminClient
    .from("training_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return mapTrainingProfileRow((data as Record<string, unknown> | null) ?? null);
}

async function upsertTrainingProfileInternal(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  trainingProfile: TrainingProfileInput;
  nutritionContext: NutritionContext;
}) {
  const normalized = normalizeTrainingProfileInput(params.trainingProfile);
  const isComplete = isTrainingProfileComplete(normalized, params.nutritionContext);

  const payload = {
    user_id: params.userId,
    primary_goal: normalized.primary_goal,
    secondary_goal: normalized.secondary_goal,
    focus_areas: normalized.focus_areas ?? [],
    experience_level: normalized.experience_level,
    days_per_week: normalized.days_per_week,
    session_minutes: normalized.session_minutes,
    training_location: normalized.training_location,
    equipment_available: normalized.equipment_available ?? [],
    activity_level: normalized.activity_level,
    cardio_preference: normalized.cardio_preference,
    exercise_preferences: normalized.exercise_preferences,
    exercise_dislikes: normalized.exercise_dislikes,
    injuries_or_pain: normalized.injuries_or_pain,
    restricted_movements: normalized.restricted_movements ?? [],
    parq_requires_attention: normalized.parq_requires_attention,
    medical_clearance_notes: normalized.medical_clearance_notes,
    is_complete: isComplete,
  };

  const { data, error } = await params.adminClient
    .from("training_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;

  await params.adminClient
    .from("profiles")
    .update({ training_profile_status: isComplete ? "complete" : "pending" })
    .eq("id", params.userId);

  return mapTrainingProfileRow(data as Record<string, unknown>);
}

async function generateRoutineDraftInternal(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  createdBy: string;
}) {
  const trainingProfile = await fetchTrainingProfileInternal(params.adminClient, params.userId);
  if (!trainingProfile) {
    await ensurePendingRoutine({
      adminClient: params.adminClient,
      userId: params.userId,
      createdBy: params.createdBy,
    });
    return { success: false, error: "No hay perfil de entrenamiento todavía." };
  }

  const nutritionContext = await getNutritionContextForUser(params.adminClient, params.userId);
  const proposal = buildRoutineProposal({
    trainingProfile,
    nutritionContext,
    exercises: await listExerciseCatalog(params.adminClient),
  });

  if (proposal.status === "pending_profile") {
    await ensurePendingRoutine({
      adminClient: params.adminClient,
      userId: params.userId,
      createdBy: params.createdBy,
      trainingProfileId: trainingProfile.id,
      primaryGoal: trainingProfile.primary_goal ?? null,
      secondaryGoal: trainingProfile.secondary_goal ?? null,
    });

    return {
      success: false,
      error: "Aún falta información para generar la propuesta.",
      missingRequirements: proposal.missingRequirements,
      warnings: proposal.warnings,
    };
  }

  const routineId = await persistRoutineDraft({
    adminClient: params.adminClient,
    userId: params.userId,
    createdBy: params.createdBy,
    trainingProfileId: trainingProfile.id,
    proposal,
    primaryGoal: trainingProfile.primary_goal ?? null,
    secondaryGoal: trainingProfile.secondary_goal ?? null,
  });

  return { success: true, routineId, warnings: proposal.warnings };
}

export async function syncTrainingProfileWithAdmin(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  createdBy: string;
  trainingProfile: TrainingProfileInput;
  nutritionContext: NutritionContext;
}) {
  const trainingProfile = await upsertTrainingProfileInternal({
    adminClient: params.adminClient,
    userId: params.userId,
    trainingProfile: params.trainingProfile,
    nutritionContext: params.nutritionContext,
  });

  await archiveDraftsAndPending(params.adminClient, params.userId).catch(() => null);

  if (trainingProfile?.is_complete) {
    const generation = await generateRoutineDraftInternal({
      adminClient: params.adminClient,
      userId: params.userId,
      createdBy: params.createdBy,
    });

    return {
      trainingProfile,
      generation,
      missingRequirements: [],
    };
  }

  await ensurePendingRoutine({
    adminClient: params.adminClient,
    userId: params.userId,
    createdBy: params.createdBy,
    trainingProfileId: trainingProfile?.id ?? null,
    primaryGoal: trainingProfile?.primary_goal ?? null,
    secondaryGoal: trainingProfile?.secondary_goal ?? null,
  });

  return {
    trainingProfile,
    generation: null,
    missingRequirements: getMissingTrainingProfileRequirements(trainingProfile || {}, params.nutritionContext),
  };
}

async function callExerciseCatalogFunction(body: Record<string, unknown>) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.isAdmin) {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sesión inválida para acceder al proveedor de ejercicios.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Falta configuración de Supabase.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${EXERCISE_CATALOG_FUNCTION}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error || "No se pudo conectar con ExerciseDB.");
  }

  return result;
}

export async function upsertTrainingProfile(userId: string, input: TrainingProfileInput) {
  const { adminClient, access } = await requireAdminAccess();
  const nutritionContext = await getNutritionContextForUser(adminClient, userId);
  const result = await syncTrainingProfileWithAdmin({
    adminClient,
    userId,
    createdBy: access.userId!,
    trainingProfile: input,
    nutritionContext,
  });

  revalidatePath("/panel/clientes");
  revalidatePath(`/panel/clientes/${userId}`);
  revalidatePath(`/panel/clientes/${userId}/history`);

  return {
    success: true,
    data: result.trainingProfile,
    missingRequirements: result.missingRequirements,
  };
}

export async function generateRoutineProposal(userId: string) {
  const { adminClient, access } = await requireAdminAccess();
  const result = await generateRoutineDraftInternal({
    adminClient,
    userId,
    createdBy: access.userId!,
  });

  revalidatePath(`/panel/clientes/${userId}`);
  revalidatePath(`/panel/clientes/${userId}/history`);

  return result;
}

export async function approveRoutineDraft(routineId: string) {
  const { adminClient, access } = await requireAdminAccess();

  const { data: routine, error: routineError } = await adminClient
    .from("routines")
    .select("id, user_id, status")
    .eq("id", routineId)
    .single();

  if (routineError || !routine?.user_id) {
    throw new Error("No se encontró la rutina.");
  }

  if (routine.status !== "draft") {
    throw new Error("Solo se pueden aprobar rutinas en borrador.");
  }

  await adminClient
    .from("routines")
    .update({ status: "archived", is_active: false })
    .eq("user_id", routine.user_id)
    .in("status", ["active", "pending_profile"]);

  const { error } = await adminClient
    .from("routines")
    .update({
      status: "active",
      is_active: true,
      source: "admin",
      reviewed_by: access.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", routineId);

  if (error) throw error;

  revalidatePath(`/panel/clientes/${routine.user_id}`);
  revalidatePath(`/panel/clientes/${routine.user_id}/history`);

  return { success: true };
}

export async function archiveRoutine(routineId: string) {
  const { adminClient } = await requireAdminAccess();

  const { data: routine, error: fetchError } = await adminClient
    .from("routines")
    .select("id, user_id")
    .eq("id", routineId)
    .single();

  if (fetchError || !routine?.user_id) {
    throw new Error("No se encontró la rutina.");
  }

  const { error } = await adminClient
    .from("routines")
    .update({ status: "archived", is_active: false })
    .eq("id", routineId);

  if (error) throw error;

  revalidatePath(`/panel/clientes/${routine.user_id}`);
  revalidatePath(`/panel/clientes/${routine.user_id}/history`);

  return { success: true };
}

export async function updateRoutineDetail(
  detailId: number,
  patch: Partial<Pick<RoutineDetailRecord, "sets" | "reps" | "rest_seconds" | "duration_minutes" | "target_rir" | "notes">>,
) {
  const { adminClient } = await requireAdminAccess();

  const { data: detail, error: detailError } = await adminClient
    .from("routine_details")
    .select("id, routine_id, routines!inner(id, user_id, status)")
    .eq("id", detailId)
    .single();

  if (detailError || !detail) {
    throw new Error("No se encontró el detalle de rutina.");
  }

  const routine = Array.isArray(detail.routines) ? detail.routines[0] : detail.routines;
  if (!routine || routine.status !== "draft") {
    throw new Error("Solo puedes editar detalles de una rutina en borrador.");
  }

  const { error } = await adminClient
    .from("routine_details")
    .update({
      sets: patch.sets ?? null,
      reps: patch.reps ?? null,
      rest_seconds: patch.rest_seconds ?? null,
      duration_minutes: patch.duration_minutes ?? null,
      target_rir: patch.target_rir ?? null,
      notes: patch.notes ?? null,
    })
    .eq("id", detailId);

  if (error) throw error;

  revalidatePath(`/panel/clientes/${routine.user_id}`);
  revalidatePath(`/panel/clientes/${routine.user_id}/history`);

  return { success: true };
}

export async function replaceRoutineExercise(detailId: number, exerciseId: number) {
  const { adminClient } = await requireAdminAccess();

  const [{ data: detail, error: detailError }, { data: exercise, error: exerciseError }] = await Promise.all([
    adminClient
      .from("routine_details")
      .select("id, routine_id, routines!inner(id, user_id, status)")
      .eq("id", detailId)
      .single(),
    adminClient.from("exercises").select("id, display_name, display_name_es, name").eq("id", exerciseId).single(),
  ]);

  if (detailError || !detail) {
    throw new Error("No se encontró el detalle de rutina.");
  }

  const routine = Array.isArray(detail.routines) ? detail.routines[0] : detail.routines;
  if (!routine || routine.status !== "draft") {
    throw new Error("Solo puedes reemplazar ejercicios en una rutina en borrador.");
  }

  if (exerciseError || !exercise) {
    throw new Error("No se encontró el ejercicio.");
  }

  const { error } = await adminClient
    .from("routine_details")
    .update({
      exercise_id: exerciseId,
      exercise_name_snapshot: exercise.display_name_es || exercise.display_name || exercise.name,
      notes: null,
    })
    .eq("id", detailId);

  if (error) throw error;

  revalidatePath(`/panel/clientes/${routine.user_id}`);
  revalidatePath(`/panel/clientes/${routine.user_id}/history`);

  return { success: true };
}

export async function searchExerciseCatalog(filters: {
  query?: string;
  bodyPart?: string;
  targetMuscle?: string;
  equipment?: string;
  limit?: number;
}) {
  const { adminClient } = await requireAdminAccess();
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);

  let query = adminClient
    .from("exercises")
    .select(
      "id, slug, name, display_name, display_name_es, provider, provider_item_id, body_parts, target_muscles, secondary_muscles, equipments, exercise_type, instructions, tips, keywords, variations, image_url, video_url, description, raw_payload, last_synced_at, is_active",
    )
    .eq("is_active", true)
    .limit(limit)
    .order("display_name", { ascending: true });

  if (filters.query?.trim()) {
    const escapedQuery = filters.query.trim().replaceAll(",", " ");
    query = query.or(
      `display_name.ilike.%${escapedQuery}%,display_name_es.ilike.%${escapedQuery}%,name.ilike.%${escapedQuery}%`,
    );
  }

  if (filters.bodyPart) {
    query = query.contains("body_parts", [filters.bodyPart]);
  }

  if (filters.targetMuscle) {
    query = query.contains("target_muscles", [filters.targetMuscle]);
  }

  if (filters.equipment) {
    query = query.contains("equipments", [filters.equipment]);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    success: true,
    data: (data || []).map((row) => normalizeExerciseCatalogItem(row as Record<string, unknown>)),
  };
}

export async function searchExerciseProvider(query: string) {
  const result = await callExerciseCatalogFunction({
    operation: "search",
    query,
  });

  return {
    success: true,
    data: (Array.isArray(result?.data) ? result.data : []).map((item: Record<string, unknown>) => ({
      exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : "",
      name: typeof item?.name === "string" ? item.name : "Exercise",
      imageUrl: typeof item?.imageUrl === "string" ? item.imageUrl : null,
    })) as ProviderExerciseSummary[],
  };
}

export async function importExerciseFromProvider(rawExercise: Record<string, unknown>) {
  const { adminClient } = await requireAdminAccess();

  const providerResult = await callExerciseCatalogFunction({
    operation: "import",
    exercise: rawExercise,
  });

  const payload = mapProviderExerciseToCatalogPayload((providerResult?.data as Record<string, unknown>) || rawExercise);
  const { data, error } = await adminClient
    .from("exercises")
    .upsert(payload, { onConflict: "slug" })
    .select(
      "id, slug, name, display_name, display_name_es, provider, provider_item_id, body_parts, target_muscles, secondary_muscles, equipments, exercise_type, instructions, tips, keywords, variations, image_url, video_url, description, raw_payload, last_synced_at, is_active",
    )
    .single();

  if (error) throw error;

  return {
    success: true,
    data: normalizeExerciseCatalogItem(data as Record<string, unknown>),
  };
}

export async function seedExerciseCatalog() {
  const { adminClient } = await requireAdminAccess();
  const keywords = [
    "chest",
    "back",
    "shoulder",
    "leg",
    "glute",
    "core",
    "cardio",
    "dumbbell",
    "barbell",
    "machine",
    "band",
    "body weight",
  ];
  const importedExerciseIds = new Set<string>();
  const failedKeywords: string[] = [];
  const errors: string[] = [];

  for (const keyword of keywords) {
    try {
      const searchResult = await callExerciseCatalogFunction({
        operation: "search",
        query: keyword,
      });

      const items = Array.isArray(searchResult?.data) ? searchResult.data.slice(0, 5) : [];

      if (items.length === 0) {
        failedKeywords.push(keyword);
        errors.push(`No se encontraron ejercicios para "${keyword}".`);
        continue;
      }

      for (const item of items) {
        const exerciseId = typeof item?.exerciseId === "string" ? item.exerciseId : "";
        if (!exerciseId || importedExerciseIds.has(exerciseId)) continue;

        const providerResult = await callExerciseCatalogFunction({
          operation: "import",
          exercise: item,
        });

        const rawExercise = (providerResult?.data as Record<string, unknown>) || item;
        const payload = mapProviderExerciseToCatalogPayload(rawExercise);

        const { error } = await adminClient
          .from("exercises")
          .upsert(payload, { onConflict: "slug" });

        if (error) {
          throw error;
        }

        importedExerciseIds.add(exerciseId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error(`Error al sembrar categoría ${keyword}:`, error);
      failedKeywords.push(keyword);
      errors.push(`"${keyword}": ${message}`);
    }
  }

  revalidatePath("/panel/ejercicios");

  const importedCount = importedExerciseIds.size;
  const success = errors.length === 0;

  if (importedCount === 0 && errors.length > 0) {
    return {
      success: false,
      importedCount,
      failedKeywords,
      errors,
      message: "No se pudo importar el catálogo inicial.",
    };
  }

  return {
    success,
    importedCount,
    failedKeywords,
    errors,
    message: success
      ? `Catálogo inicial importado exitosamente (${importedCount} ejercicios).`
      : `Importación parcial completada (${importedCount} ejercicios).`,
  };
}

export async function getCustomerRoutineWorkspace(customerId: string): Promise<CustomerRoutineWorkspace> {
  const { adminClient } = await requireAdminAccess();
  const [trainingProfile, nutritionContext, routinesResponse] = await Promise.all([
    fetchTrainingProfileInternal(adminClient, customerId),
    getNutritionContextForUser(adminClient, customerId),
    adminClient
      .from("routines")
      .select("*")
      .eq("user_id", customerId)
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }),
  ]);

  if (routinesResponse.error) throw routinesResponse.error;

  const routines = (routinesResponse.data || []).map((row) => mapRoutineRow(row as Record<string, unknown>));
  const draftRoutine = routines.find((routine) => routine.status === "draft") || null;
  const activeRoutine = routines.find((routine) => routine.status === "active") || null;
  const pendingRoutine = routines.find((routine) => routine.status === "pending_profile") || null;
  const detailsRoutineIds = [draftRoutine?.id, activeRoutine?.id, pendingRoutine?.id].filter(Boolean) as string[];

  let detailsByRoutineId: Record<string, RoutineDetailRecord[]> = {};
  if (detailsRoutineIds.length > 0) {
    const { data: details, error: detailsError } = await adminClient
      .from("routine_details")
      .select("*")
      .in("routine_id", detailsRoutineIds)
      .order("day_of_week", { ascending: true })
      .order("exercise_order", { ascending: true })
      .order("id", { ascending: true });

    if (detailsError) throw detailsError;

    detailsByRoutineId = (details || []).reduce<Record<string, RoutineDetailRecord[]>>((accumulator, row) => {
      const mapped = mapRoutineDetailRow(row as Record<string, unknown>);
      accumulator[mapped.routine_id] = accumulator[mapped.routine_id] || [];
      accumulator[mapped.routine_id].push(mapped);
      return accumulator;
    }, {});
  }

  return {
    trainingProfile,
    nutritionContext,
    trainingProfileStatus: trainingProfile?.is_complete ? "complete" : "pending",
    missingRequirements: getMissingTrainingProfileRequirements(trainingProfile || {}, nutritionContext),
    draftRoutine,
    activeRoutine,
    pendingRoutine,
    draftDetails: draftRoutine ? detailsByRoutineId[draftRoutine.id] || [] : [],
    activeDetails: activeRoutine ? detailsByRoutineId[activeRoutine.id] || [] : [],
    pendingDetails: pendingRoutine ? detailsByRoutineId[pendingRoutine.id] || [] : [],
  };
}
