import type { ExerciseCatalogItem } from "@/lib/training/types";

export function slugifyExercise(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildExerciseSlug(params: {
  name: string;
  bodyParts?: string[] | null;
  equipments?: string[] | null;
  exerciseType?: string | null;
}) {
  const segments = [
    params.name,
    params.bodyParts?.[0] || "",
    params.equipments?.[0] || "",
    params.exerciseType || "",
  ]
    .filter(Boolean)
    .map(slugifyExercise)
    .filter(Boolean);

  return segments.join("-").slice(0, 120);
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function normalizeExerciseCatalogItem(row: Record<string, unknown>): ExerciseCatalogItem {
  return {
    id: Number(row.id),
    slug: typeof row.slug === "string" ? row.slug : null,
    name: typeof row.name === "string" ? row.name : "",
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    display_name_es: typeof row.display_name_es === "string" ? row.display_name_es : null,
    provider: typeof row.provider === "string" ? row.provider : null,
    provider_item_id: typeof row.provider_item_id === "string" ? row.provider_item_id : null,
    body_parts: normalizeStringArray(row.body_parts),
    target_muscles: normalizeStringArray(row.target_muscles),
    secondary_muscles: normalizeStringArray(row.secondary_muscles),
    equipments: normalizeStringArray(row.equipments),
    exercise_type: typeof row.exercise_type === "string" ? row.exercise_type : null,
    instructions: normalizeStringArray(row.instructions),
    tips: normalizeStringArray(row.tips),
    keywords: normalizeStringArray(row.keywords),
    variations: normalizeStringArray(row.variations),
    image_url:
      typeof row.image_url === "string"
        ? row.image_url
        : typeof row.animation_url === "string"
          ? row.animation_url
          : null,
    video_url: typeof row.video_url === "string" ? row.video_url : null,
    description: typeof row.description === "string" ? row.description : null,
    raw_payload: row.raw_payload,
    last_synced_at: typeof row.last_synced_at === "string" ? row.last_synced_at : null,
    is_active: row.is_active !== false,
  };
}

export function mapProviderExerciseToCatalogPayload(raw: Record<string, unknown>) {
  const name = typeof raw.name === "string" ? raw.name : "Exercise";
  const bodyParts = normalizeStringArray(raw.bodyParts);
  const equipments = normalizeStringArray(raw.equipments);
  const exerciseType = typeof raw.exerciseType === "string" ? raw.exerciseType : null;

  return {
    slug: buildExerciseSlug({
      name,
      bodyParts,
      equipments,
      exerciseType,
    }),
    name,
    display_name: name,
    display_name_es: null,
    provider: "exercisedb",
    provider_item_id: typeof raw.exerciseId === "string" ? raw.exerciseId : null,
    body_parts: bodyParts,
    target_muscles: normalizeStringArray(raw.targetMuscles),
    secondary_muscles: normalizeStringArray(raw.secondaryMuscles),
    equipments,
    exercise_type: exerciseType,
    instructions: normalizeStringArray(raw.instructions),
    tips: normalizeStringArray(raw.exerciseTips),
    keywords: normalizeStringArray(raw.keywords),
    variations: normalizeStringArray(raw.variations),
    image_url: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    video_url: typeof raw.videoUrl === "string" ? raw.videoUrl : null,
    description: typeof raw.overview === "string" ? raw.overview : null,
    animation_url: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    equipment_needed: equipments[0] || null,
    target_muscle: normalizeStringArray(raw.targetMuscles)[0] || null,
    raw_payload: raw,
    last_synced_at: new Date().toISOString(),
    is_active: true,
  };
}
