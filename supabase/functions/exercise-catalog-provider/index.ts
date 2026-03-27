/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_RAPIDAPI_HOST = "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";

interface ProviderRequestBody {
  operation?: "search" | "import" | "refresh";
  query?: string;
  exerciseId?: string;
  exercise?: Record<string, unknown> | null;
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function getAdminClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !serviceKey || !anonKey) {
    throw new Error("Falta configurar las credenciales de Supabase.");
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    throw new Error("No autenticado");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") {
    throw new Error("No autorizado");
  }

  return supabaseAdmin;
}

function getProviderConfig() {
  const rapidApiKey = Deno.env.get("EXERCISEDB_RAPIDAPI_KEY") ?? "";
  const rapidApiHost = Deno.env.get("EXERCISEDB_RAPIDAPI_HOST") ?? DEFAULT_RAPIDAPI_HOST;

  if (!rapidApiKey) {
    throw new Error("Falta EXERCISEDB_RAPIDAPI_KEY en los secretos de Supabase.");
  }

  return {
    rapidApiKey,
    rapidApiHost,
    baseUrl: `https://${rapidApiHost}`,
  };
}

async function fetchExerciseDb(path: string, searchParams?: Record<string, string | undefined>) {
  const { rapidApiHost, rapidApiKey, baseUrl } = getProviderConfig();
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value && value.trim()) {
      url.searchParams.set(key, value.trim());
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": rapidApiKey,
      "X-RapidAPI-Host": rapidApiHost,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage =
      payload?.error?.message || payload?.message || payload?.error || `ExerciseDB request failed with ${response.status}`;
    throw new Error(providerMessage);
  }

  return payload;
}

function normalizeSummary(item: Record<string, unknown>) {
  return {
    exerciseId: typeof item.exerciseId === "string" ? item.exerciseId : "",
    name: typeof item.name === "string" ? item.name : "Exercise",
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
  };
}

async function handleSearch(query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const [fuzzyPayload, filteredPayload] = await Promise.all([
    fetchExerciseDb("/api/v1/exercises/search", { search: trimmedQuery }),
    fetchExerciseDb("/api/v1/exercises", { name: trimmedQuery, limit: "12" }),
  ]);

  const merged = new Map<string, ReturnType<typeof normalizeSummary>>();
  const fuzzyResults = Array.isArray(fuzzyPayload?.data) ? fuzzyPayload.data : [];
  const filteredResults = Array.isArray(filteredPayload?.data) ? filteredPayload.data : [];

  for (const item of [...fuzzyResults, ...filteredResults]) {
    const normalized = normalizeSummary((item || {}) as Record<string, unknown>);
    if (normalized.exerciseId) {
      merged.set(normalized.exerciseId, normalized);
    }
  }

  return Array.from(merged.values()).slice(0, 12);
}

function resolveExerciseId(body: ProviderRequestBody) {
  if (typeof body.exerciseId === "string" && body.exerciseId.trim()) {
    return body.exerciseId.trim();
  }

  const nestedExerciseId =
    typeof body.exercise?.exerciseId === "string"
      ? body.exercise.exerciseId
      : typeof body.exercise?.provider_item_id === "string"
        ? body.exercise.provider_item_id
        : null;

  return nestedExerciseId?.trim() || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAdminClient(req);

    const body = (await req.json().catch(() => ({}))) as ProviderRequestBody;
    const operation = body.operation;

    if (!operation) {
      return jsonResponse(400, { error: "operation es obligatorio" });
    }

    if (operation === "search") {
      const data = await handleSearch(body.query || "");
      return jsonResponse(200, { success: true, data });
    }

    const exerciseId = resolveExerciseId(body);
    if (!exerciseId) {
      return jsonResponse(400, { error: "exerciseId es obligatorio para importar o refrescar." });
    }

    const payload = await fetchExerciseDb(`/api/v1/exercises/${exerciseId}`);
    return jsonResponse(200, { success: true, data: payload?.data || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
    return jsonResponse(status, { error: message });
  }
});
