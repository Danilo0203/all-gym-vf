"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createClientAdmin } from "@supabase/supabase-js";
import { getUserEmail } from "@/lib/supabase/admin";
import { computeFitnessPlan } from "@/lib/fitness/excel-calculator";
import type { ActivityLevel, BodyType, DietType } from "@/lib/fitness/types";
import { generateRoutineFromTemplates } from "@/lib/fitness/routine-generator";
import { getUserAccessContext } from "@/lib/auth/authorization";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface CreateCustomerData {
  // Auth
  email: string;
  password?: string;
  // Profile
  full_name: string;
  phone: string;
  birth_date?: Date;
  gender: "male" | "female" | "other";
  emergency_contact?: string;
  emergency_phone?: string;
  // Subscription
  plan_id: number;
  final_price?: number;
  discount_amount?: number;
  payment_method?: "cash" | "card" | "transfer";
  start_date?: Date;
  end_date?: Date;
  // Body Assessment
  weight_kg: number;
  height_cm: number;
  diet_type: DietType;
  activity_level: ActivityLevel;
  body_fat_percentage?: number;
  muscle_mass_kg?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  arm_right?: number;
  arm_left?: number;
  leg_right?: number;
  leg_left?: number;
  injuries?: string;
  body_type: BodyType;
  notes?: string;
}

export async function createCustomer(data: CreateCustomerData) {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!access.isAdmin) return { success: false, error: "No autorizado: Solo administradores" };

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { success: false, error: "Sesión inválida. Inicia sesión nuevamente." };
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-customer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password || undefined,
        full_name: data.full_name,
        phone: data.phone,
        birth_date: data.birth_date ? data.birth_date.toISOString().split("T")[0] : null,
        gender: data.gender,
        plan_id: data.plan_id,
        final_price: data.final_price,
        discount_amount: data.discount_amount || 0,
        payment_method: data.payment_method || "cash",
        start_date: data.start_date ? data.start_date.toISOString().split("T")[0] : null,
        end_date: data.end_date ? data.end_date.toISOString().split("T")[0] : null,
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        diet_type: data.diet_type,
        activity_level: data.activity_level,
        body_fat_percentage: data.body_fat_percentage ?? null,
        muscle_mass_kg: data.muscle_mass_kg ?? null,
        chest: data.chest ?? null,
        waist: data.waist ?? null,
        hip: data.hip ?? null,
        arm_right: data.arm_right ?? null,
        arm_left: data.arm_left ?? null,
        leg_right: data.leg_right ?? null,
        leg_left: data.leg_left ?? null,
        injuries: data.injuries || null,
        body_type: data.body_type,
        notes: data.notes || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Error from Edge Function:", result);
      return { success: false, error: result.error || "Error al crear cliente" };
    }

    revalidatePath("/panel/clientes");
    revalidatePath("/panel/resumen");
    return { success: true, data: result };
  } catch (error) {
    console.error("Error creating customer:", error);
    return { success: false, error: "Error de conexión" };
  }
}

export async function getPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price, duration_days")
    .eq("is_active", true)
    .order("price");

  if (error) {
    console.error("Error fetching plans:", error);
    return [];
  }
  return data || [];
}

export async function getCustomerById(id: string) {
  const supabase = await createClient();

  // Intentar obtener desde la vista customer_overview que ya sabemos que funciona para la lista
  const { data: customerView, error: viewError } = await supabase
    .from("customer_overview")
    .select(
      "id, full_name, phone, avatar_url, role, subscription_status, subscription_start_date, subscription_end_date, plan_name, last_check_in, plan_id, birth_date, gender, is_active",
    )
    .eq("id", id)
    .single();

  console.log("Customer View Data:", customerView);

  if (viewError) {
    console.error("Error fetching customer view:", viewError);
    // Fallback a profiles si falla la vista
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
    return profile;
  }

  // Obtener el email del usuario desde auth.users usando el admin client
  const userEmail = await getUserEmail(id);

  // Obtener los datos físicos más recientes
  const { data: bodyAssessment } = await supabase
    .from("body_assessments")
    .select("*")
    .eq("user_id", id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle(); // Usar maybeSingle por si no hay registros

  const { data: latestSnapshot } = await supabase
    .from("training_nutrition_snapshots")
    .select("*")
    .eq("user_id", id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Si la vista no tiene plan_id pero tiene plan_name, necesitamos obtener el ID del plan
  let planId = customerView.plan_id;

  if (!planId && customerView.plan_name) {
    console.log(`Searching plan by name: "${customerView.plan_name}"`);
    const { data: plan } = await supabase.from("plans").select("id").ilike("name", customerView.plan_name).single();

    if (plan) {
      console.log(`Plan found via name lookup: ${plan.id}`);
      planId = plan.id;
    } else {
      console.log("Plan NOT found by name");
      // Intento con búsqueda parcial si falla la exacta
      const { data: planPartial } = await supabase
        .from("plans")
        .select("id")
        .ilike("name", `%${customerView.plan_name}%`)
        .limit(1)
        .single();

      if (planPartial) {
        console.log(`Plan found via partial lookup: ${planPartial.id}`);
        planId = planPartial.id;
      } else {
        // Último recurso: traer todos los planes y buscar en memoria
        console.log("Plan NOT found via partial lookup. Trying in-memory search...");
        const { data: allPlans } = await supabase.from("plans").select("id, name");
        if (allPlans) {
          const match = allPlans.find(
            (p) =>
              p.name.toLowerCase().includes(customerView.plan_name.toLowerCase()) ||
              customerView.plan_name.toLowerCase().includes(p.name.toLowerCase()),
          );
          if (match) {
            console.log(`Plan found via in-memory search: ${match.name} (${match.id})`);
            planId = match.id;
          } else {
            console.log("Plan NOT found in-memory.");
          }
        }
      }
    }
  }

  // Fetch subscription for editing: prioritize ACTIVE, fallback to most recent
  // First try to get active subscription
  let latestSubscription = null;

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("*, plans(id, name)")
    .eq("user_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeSubscription) {
    latestSubscription = activeSubscription;
  } else {
    // No active subscription, get most recent (expired)
    const { data: recentSubscription } = await supabase
      .from("subscriptions")
      .select("*, plans(id, name)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestSubscription = recentSubscription;
  }

  // Fetch profile data
  const { data: profileData } = await supabase
    .from("profiles")
    .select("birth_date, injuries, gender")
    .eq("id", id)
    .maybeSingle();

  // Fetch Payment Method from latest subscription
  let paymentMethod = null;

  if (latestSubscription) {
    const { data: lastPayment } = await supabase
      .from("payments")
      .select("method")
      .eq("subscription_id", latestSubscription.id)
      .maybeSingle();

    if (lastPayment) {
      paymentMethod = lastPayment.method;
    }
  }

  // Determine Plan ID from latest subscription (authoritative) or fallback to View
  // IMPORTANTE: Si updatedCustomerView tiene un plan_id pero latestSubscription no (null),
  // puede que sea un plan \"legacy\" o inconsistencia. Priorizamos latestSubscription si existe.
  let finalPlanId = latestSubscription?.plan_id;
  if (!finalPlanId && customerView.plan_id) finalPlanId = customerView.plan_id;
  if (!finalPlanId && planId) finalPlanId = planId; // Fallback from expensive search logic if needed

  // Mapear los datos de la vista a lo que espera el formulario
  return {
    ...customerView, // Tiene full_name, phone, etc. (pero NO email)
    email: userEmail, // Email obtenido desde auth.users
    birth_date: profileData?.birth_date || customerView.birth_date || null,
    gender: profileData?.gender || customerView.gender || null,
    injuries: profileData?.injuries || null,

    // Datos de suscripción REFRESCADOS desde la tabla real
    plan_id: finalPlanId || null,
    payment_method: paymentMethod || "cash",

    // Usar fechas de la suscripción más reciente si existe, sino fallback a vista
    subscription_start_date: latestSubscription?.start_date || customerView.subscription_start_date || null,
    subscription_end_date: latestSubscription?.end_date || customerView.subscription_end_date || null,

    // Descuento aplicado (de la suscripción más reciente)
    discount_amount: latestSubscription?.discount_amount ?? 0,

    // Datos físicos
    weight_kg: bodyAssessment?.weight_kg || null,
    height_cm: bodyAssessment?.height_cm || null,
    body_type: bodyAssessment?.body_type || null,
    activity_level: bodyAssessment?.activity_level || latestSnapshot?.activity_level || null,
    diet_type: bodyAssessment?.diet_type || latestSnapshot?.diet_type || null,
    body_fat_percentage: bodyAssessment?.body_fat_percentage || null,
    muscle_mass_kg: bodyAssessment?.muscle_mass_kg || null,
    chest: bodyAssessment?.chest || null,
    waist: bodyAssessment?.waist || null,
    hip: bodyAssessment?.hip || null,
    arm_right: bodyAssessment?.arm_right || null,
    arm_left: bodyAssessment?.arm_left || null,
    leg_right: bodyAssessment?.leg_right || null,
    leg_left: bodyAssessment?.leg_left || null,
    notes: bodyAssessment?.notes || null,
    body_assessment_id: bodyAssessment?.id || null,
  };
}

// Helper para formatear Date a YYYY-MM-DD usando tiempo local (evita cambios por UTC)
function formatToLocalISO(date: Date | undefined | null): string | undefined | null {
  if (date === null) return null;
  if (date === undefined) return undefined;

  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface AssessmentMetrics {
  weight_kg: number;
  height_cm: number;
  body_type: BodyType;
  diet_type: DietType;
  activity_level: ActivityLevel;
  body_fat_percentage?: number;
  muscle_mass_kg?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  arm_right?: number;
  arm_left?: number;
  leg_right?: number;
  leg_left?: number;
  notes?: string;
}

async function createAssessmentAndSnapshot(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  birthDate: Date;
  gender: "male" | "female" | "other";
  sourceEvent: "signup" | "renewal";
  subscriptionId?: string | null;
  metrics: AssessmentMetrics;
}) {
  const { supabase, userId, birthDate, gender, sourceEvent, subscriptionId, metrics } = params;
  const computed = computeFitnessPlan({
    birthDate,
    gender,
    weightKg: metrics.weight_kg,
    heightCm: metrics.height_cm,
    bodyType: metrics.body_type,
    dietType: metrics.diet_type,
    activityLevel: metrics.activity_level,
  });

  const assessmentPayload = {
    user_id: userId,
    date: new Date().toISOString().split("T")[0],
    weight_kg: metrics.weight_kg,
    height_cm: metrics.height_cm,
    body_type: metrics.body_type,
    diet_type: metrics.diet_type,
    activity_level: metrics.activity_level,
    body_fat_percentage: metrics.body_fat_percentage ?? null,
    muscle_mass_kg: metrics.muscle_mass_kg ?? null,
    chest: metrics.chest ?? null,
    waist: metrics.waist ?? null,
    hip: metrics.hip ?? null,
    arm_right: metrics.arm_right ?? null,
    arm_left: metrics.arm_left ?? null,
    leg_right: metrics.leg_right ?? null,
    leg_left: metrics.leg_left ?? null,
    notes: metrics.notes ?? null,
    water_liters_goal: computed.waterLitersGoal,
    daily_calories: computed.dailyCalories,
    protein_grams: computed.proteinGrams,
    carbs_grams: computed.carbsGrams,
    fat_grams: computed.fatGrams,
  };

  const { error: assessmentError } = await supabase.from("body_assessments").insert(assessmentPayload);
  if (assessmentError) throw assessmentError;

  const snapshotPayload = {
    user_id: userId,
    source_event: sourceEvent,
    subscription_id: subscriptionId ?? null,
    gender,
    age_years: computed.ageYears,
    height_cm: metrics.height_cm,
    weight_kg: metrics.weight_kg,
    body_type: metrics.body_type,
    diet_type: metrics.diet_type,
    activity_level: metrics.activity_level,
    body_fat_percentage: metrics.body_fat_percentage ?? null,
    muscle_mass_kg: metrics.muscle_mass_kg ?? null,
    chest_cm: metrics.chest ?? null,
    waist_cm: metrics.waist ?? null,
    arm_right_cm: metrics.arm_right ?? null,
    arm_left_cm: metrics.arm_left ?? null,
    hip_cm: metrics.hip ?? null,
    leg_right_cm: metrics.leg_right ?? null,
    leg_left_cm: metrics.leg_left ?? null,
    notes: metrics.notes ?? null,
    daily_calories: computed.dailyCalories,
    protein_grams: computed.proteinGrams,
    carbs_grams: computed.carbsGrams,
    fat_grams: computed.fatGrams,
    water_liters_goal: computed.waterLitersGoal,
    cardio_minutes: computed.cardioMinutes,
    routine_mode: computed.routineMode,
    algorithm_version: computed.algorithmVersion,
  };

  const { error: snapshotError } = await supabase.from("training_nutrition_snapshots").insert(snapshotPayload);
  if (snapshotError) throw snapshotError;

  return computed;
}

export async function updateCustomer(id: string, data: Partial<CreateCustomerData>, accessToken?: string) {
  const supabase = await createClient();

  console.log(`Updating customer ${id}`, data);

  try {
    // 0. Actualizar contraseña si se proporciona
    if (data.password && data.password.length >= 6) {
      console.log(`Updating password for user ${id}`);

      if (!accessToken) {
        console.error("No access token provided for password update");
        return { success: false, error: "No hay sesión activa. Por favor, inicia sesión nuevamente." };
      }

      try {
        const passwordResponse = await fetch(`${SUPABASE_URL}/functions/v1/update-customer-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id: id,
            new_password: data.password,
          }),
        });

        // Handle non-JSON responses (like 404)
        const contentType = passwordResponse.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error("Password update failed - Edge Function may not be deployed. Status:", passwordResponse.status);
          return {
            success: false,
            error: `Error: La función de cambio de contraseña no está disponible (Status: ${passwordResponse.status}). Despliega la Edge Function 'update-customer-password'.`,
          };
        }

        const passwordResult = await passwordResponse.json();

        if (!passwordResponse.ok) {
          console.error("Error updating password:", passwordResult);
          return {
            success: false,
            error: `Error al cambiar contraseña: ${passwordResult.error || passwordResult.message || "Error desconocido"}`,
          };
        }

        console.log("Password updated successfully");
      } catch (fetchError) {
        console.error("Fetch error updating password:", fetchError);
        return { success: false, error: "Error de conexión al actualizar contraseña" };
      }
    }

    // 1. Actualizar el perfil
    const profileUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.full_name !== undefined) profileUpdate.full_name = data.full_name;
    if (data.phone !== undefined) profileUpdate.phone = data.phone;
    if (data.birth_date !== undefined) profileUpdate.birth_date = formatToLocalISO(data.birth_date);
    if (data.gender !== undefined) profileUpdate.gender = data.gender;
    if (data.injuries !== undefined) profileUpdate.injuries = data.injuries || null;

    const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return { success: false, error: `Error perfil: ${profileError.message}` };
    }

    // 2. Gestión de Suscripción
    console.log("Plan ID received:", data.plan_id, "Type:", typeof data.plan_id);

    // Verificar que plan_id sea un número válido mayor a 0
    const validPlanId = typeof data.plan_id === "number" && data.plan_id > 0;

    if (validPlanId) {
      // Buscar la suscripción MÁS RECIENTE (activa o expirada) para actualizarla
      // Prioriza las activas, pero si no hay, usa la expirada más reciente
      const { data: currentSubscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", id)
        .in("status", ["active", "expired"]) // Incluir ambos estados
        .order("status", { ascending: true }) // 'active' viene primero
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Columnas de la tabla subscriptions: user_id, plan_id, start_date, end_date, status, discount_amount
      const newSubscriptionData = {
        user_id: id,
        plan_id: data.plan_id,
        start_date: formatToLocalISO(data.start_date),
        end_date: formatToLocalISO(data.end_date),
        discount_amount: data.discount_amount || 0,
        status: "active", // Siempre guardar como active al editar
      };

      if (!currentSubscription) {
        console.log("No active subscription found. Creating new one.");
        const { error: insertError } = await supabase.from("subscriptions").insert(newSubscriptionData);
        if (insertError) console.error("Error creating subscription:", insertError);
      } else {
        console.log(
          `Updating existing subscription ${currentSubscription.id} with new details (Plan: ${data.plan_id})`,
        );

        // ACTUALIZAR la suscripción existente, incluso si cambia el plan
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            plan_id: data.plan_id, // Actualizar el plan
            start_date: newSubscriptionData.start_date,
            end_date: newSubscriptionData.end_date,
            discount_amount: newSubscriptionData.discount_amount,
            status: "active", // Reactivar si estaba expirada
          })
          .eq("id", currentSubscription.id);

        if (updateError) {
          console.error("Error updating existing subscription:", updateError);
        } else {
          // 2.1 Actualizar también el registro de PAGO asociado para mantener la consistencia financiera
          // Obtener el precio del nuevo plan
          const { data: planData } = await supabase.from("plans").select("price").eq("id", data.plan_id).single();

          if (planData) {
            const newOriginalAmount = Number(planData.price);
            const newDiscount = Number(newSubscriptionData.discount_amount);
            const newFinalAmount = newOriginalAmount - newDiscount;

            console.log(
              `Syncing payment data for subscription ${currentSubscription.id}: Original=${newOriginalAmount}, Discount=${newDiscount}, Final=${newFinalAmount}`,
            );

            const paymentUpdateData: Record<string, unknown> = {
              amount_original: newOriginalAmount,
              discount_amount: newDiscount,
              amount_paid: newFinalAmount,
            };

            if (data.payment_method) {
              paymentUpdateData.method = data.payment_method;
            }

            // Actualizar la fecha del pago con la fecha de inicio de la suscripción
            if (data.start_date) {
              paymentUpdateData.payment_date = new Date(data.start_date).toISOString();
            }

            const { error: paymentError } = await supabase
              .from("payments")
              .update(paymentUpdateData)
              .eq("subscription_id", currentSubscription.id);

            if (paymentError) console.error("Error syncing payment data:", paymentError);
          }
        }
      }
    }

    // 3. Body Assessment
    if (
      data.weight_kg !== undefined ||
      data.height_cm !== undefined ||
      data.body_type !== undefined ||
      data.diet_type !== undefined ||
      data.activity_level !== undefined
    ) {
      console.log("Updating body assessment for customer", id, {
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        body_type: data.body_type,
      });

      const { data: existingAssessment, error: fetchAssessError } = await supabase
        .from("body_assessments")
        .select("id")
        .eq("user_id", id)
        .order("date", { ascending: false }) // Cambiado de created_at a date
        .limit(1)
        .maybeSingle();

      if (fetchAssessError) {
        console.error("Error fetching existing assessment:", fetchAssessError);
      }

      const assessmentData: Record<string, unknown> = {
        user_id: id,
      };
      if (data.weight_kg !== undefined) assessmentData.weight_kg = data.weight_kg;
      if (data.height_cm !== undefined) assessmentData.height_cm = data.height_cm;
      if (data.body_type !== undefined) assessmentData.body_type = data.body_type;
      if (data.diet_type !== undefined) assessmentData.diet_type = data.diet_type;
      if (data.activity_level !== undefined) assessmentData.activity_level = data.activity_level;
      if (data.body_fat_percentage !== undefined) assessmentData.body_fat_percentage = data.body_fat_percentage;
      if (data.muscle_mass_kg !== undefined) assessmentData.muscle_mass_kg = data.muscle_mass_kg;
      if (data.chest !== undefined) assessmentData.chest = data.chest;
      if (data.waist !== undefined) assessmentData.waist = data.waist;
      if (data.hip !== undefined) assessmentData.hip = data.hip;
      if (data.arm_right !== undefined) assessmentData.arm_right = data.arm_right;
      if (data.arm_left !== undefined) assessmentData.arm_left = data.arm_left;
      if (data.leg_right !== undefined) assessmentData.leg_right = data.leg_right;
      if (data.leg_left !== undefined) assessmentData.leg_left = data.leg_left;
      if (data.notes !== undefined) assessmentData.notes = data.notes;

      if (existingAssessment) {
        console.log("Updating existing assessment", existingAssessment.id);
        const { error: assessError } = await supabase
          .from("body_assessments")
          .update(assessmentData)
          .eq("id", existingAssessment.id);
        if (assessError) console.error("Error updating assessment:", assessError);
      } else {
        console.log("Creating new assessment");
        const { error: assessError } = await supabase
          .from("body_assessments")
          .insert({ ...assessmentData, date: new Date().toISOString().split("T")[0] });
        if (assessError) console.error("Error creating assessment:", assessError);
      }
    }

    console.log("Update sequence completed successfully for", id);
    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${id}`);
    revalidatePath("/panel/resumen");

    return { success: true };
  } catch (error) {
    console.error("CRITICAL: Exception in updateCustomer action:", error);
    return { success: false, error: "Excepción al actualizar. Revisa los logs." };
  }
}

export interface RenewSubscriptionData {
  plan_id: number;
  start_date: Date;
  end_date: Date;
  price: number;
  discount_amount: number;
  amount_paid: number;
  payment_method: "cash" | "card" | "transfer";
  // Physical Assessment
  weight_kg: number;
  height_cm: number;
  body_type: BodyType;
  diet_type: DietType;
  activity_level: ActivityLevel;
  body_fat_percentage?: number;
  muscle_mass_kg?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  arm_right?: number;
  arm_left?: number;
  leg_right?: number;
  leg_left?: number;
  injuries?: string;
  notes?: string;
}

export async function renewSubscription(customerId: string, data: RenewSubscriptionData) {
  const supabase = await createClient();
  console.log(`Renewing subscription for customer ${customerId}`, data);

  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!access.isAdmin) return { success: false, error: "No autorizado: Solo administradores" };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("birth_date, gender")
      .eq("id", customerId)
      .single();

    if (profileError || !profile?.birth_date || !profile?.gender) {
      return { success: false, error: "No se pudo obtener perfil (nacimiento/género)." };
    }

    // 1. Archivar TODAS las suscripciones activas anteriores
    const { error: archiveError } = await supabase
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("user_id", customerId)
      .eq("status", "active");

    if (archiveError) {
      console.error("Error archiving previous subscriptions:", archiveError);
      return { success: false, error: "Error archivando suscripción anterior" };
    }

    // 2. Crear NUEVA suscripción
    const { data: newSubscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: customerId,
        plan_id: data.plan_id,
        start_date: formatToLocalISO(data.start_date),
        end_date: formatToLocalISO(data.end_date),
        status: "active",
        discount_amount: data.discount_amount,
      })
      .select()
      .single();

    if (subError || !newSubscription) {
      console.error("Error creating new subscription:", subError);
      return { success: false, error: "Error creando nueva suscripción" };
    }

    // 3. Registrar el PAGO
    const { error: payError } = await supabase.from("payments").insert({
      subscription_id: newSubscription.id,
      user_id: customerId,
      amount_original: data.price,
      discount_amount: data.discount_amount,
      amount_paid: data.amount_paid,
      method: data.payment_method,
      payment_date: new Date().toISOString(),
    });

    if (payError) {
      console.error("Error recording payment:", payError);
      // No revertimos todo, pero logueamos el error grave
    }

    const computed = await createAssessmentAndSnapshot({
      supabase,
      userId: customerId,
      birthDate: new Date(profile.birth_date),
      gender: profile.gender as "male" | "female" | "other",
      sourceEvent: "renewal",
      subscriptionId: newSubscription.id,
      metrics: {
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        body_type: data.body_type,
        diet_type: data.diet_type,
        activity_level: data.activity_level,
        body_fat_percentage: data.body_fat_percentage,
        muscle_mass_kg: data.muscle_mass_kg,
        chest: data.chest,
        waist: data.waist,
        hip: data.hip,
        arm_right: data.arm_right,
        arm_left: data.arm_left,
        leg_right: data.leg_right,
        leg_left: data.leg_left,
        notes: data.notes || data.injuries,
      },
    });

    try {
      await supabase.from("routines").update({ is_active: false }).eq("user_id", customerId).eq("is_active", true);

      await generateRoutineFromTemplates({
        supabase,
        userId: customerId,
        createdBy: access.userId!,
        bodyType: data.body_type,
        routineMode: computed.routineMode,
        startDate: formatToLocalISO(data.start_date) as string,
        endDate: formatToLocalISO(data.end_date) as string,
      });
    } catch (routineError) {
      console.error("Routine generation warning:", routineError);
    }

    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${customerId}`);
    revalidatePath("/panel/resumen");

    return { success: true };
  } catch (error) {
    console.error("Exception in renewSubscription:", error);
    return { success: false, error: "Error inesperado al renovar" };
  }
}

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function deleteCustomer(id: string) {
  // Use Service Role Key to bypass RLS policies
  const supabase = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", id);

    if (error) {
      console.error("Error soft deleting customer (admin):", error);
      return { success: false, error: "Error al desactivar cliente" };
    }

    revalidatePath("/panel/clientes");
    return { success: true };
  } catch (error) {
    console.error("Exception in deleteCustomer:", error);
    return { success: false, error: "Error inesperado al desactivar" };
  }
}

export async function reactivateCustomer(id: string) {
  // Use Service Role Key to bypass RLS policies
  const supabase = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { error } = await supabase.from("profiles").update({ is_active: true }).eq("id", id);

    if (error) {
      console.error("Error reactivating customer (admin):", error);
      return { success: false, error: "Error al reactivar cliente" };
    }

    revalidatePath("/panel/clientes");
    return { success: true };
  } catch (error) {
    console.error("Exception in reactivateCustomer:", error);
    return { success: false, error: "Error inesperado al reactivar" };
  }
}

/**
 * Envía el comando ENROLL_USER al dispositivo SpeedFace H5L.
 * Backup=50 = Rostro (Face), Backup=51 = Palma. Sin Backup abre el menú para elegir.
 * Usa el cliente admin para el insert en device_commands (evita fallos por RLS).
 */
export async function enrollBiometricOnDevice(
  customerId: string,
  deviceSn: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // 0. Solo admins pueden enviar comandos al dispositivo
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Debes iniciar sesión." };
    }
    const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (callerProfile?.role !== "admin") {
      return { success: false, error: "Solo un administrador puede registrar biometría." };
    }

    // 1. Obtener el ID biométrico del perfil (con admin para evitar RLS en profiles)
    const adminClient = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("biometric_id, full_name")
      .eq("id", customerId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "No se encontró el cliente." };
    }

    if (!profile.biometric_id) {
      return { success: false, error: "El cliente no tiene un ID Numérico (biometric_id) asignado." };
    }

    // 2. Insertar el comando en la cola (admin bypassa RLS en device_commands)
    // SpeedFace H5L: Backup=50 = Rostro (Face), Backup=51 = Palma. Sin Backup abre menú para elegir.
    const command = `ENROLL_USER PIN=${profile.biometric_id} Backup=50`;
    const { error: insertError } = await adminClient.from("device_commands").insert({
      device_id: deviceSn,
      command: command,
      executed: false,
    });

    if (insertError) {
      console.error("Error al enviar comando de biometría:", insertError);
      return { success: false, error: "Error al guardar el comando en la base de datos." };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in enrollBiometricOnDevice:", error);
    return { success: false, error: "Error inesperado al procesar la solicitud." };
  }
}
