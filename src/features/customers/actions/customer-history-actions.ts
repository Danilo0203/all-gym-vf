"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserEmail } from "@/lib/supabase/admin";

// Tipos para el historial del cliente
export interface CustomerHistoryKPIs {
  totalSpent: number;
  memberSince: string | null;
  totalVisits: number;
  initialWeight: number | null;
  currentWeight: number | null;
  weightChange: number | null;
}

export interface AccessLogEntry {
  id: string;
  check_in_time: string;
  day_of_week: string;
  status: string;
}

export interface PaymentEntry {
  id: string;
  payment_date: string;
  plan_name: string;
  amount_original: number;
  amount_paid: number;
  discount_applied: number;
  payment_method: string;
  subscription_status: string;
  subscription_start: string;
  subscription_end: string;
}

export interface BodyAssessmentEntry {
  id: string;
  assessment_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percentage: number | null;
  muscle_mass: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  body_type: string | null;
  notes: string | null;
}

export interface SubscriptionEntry {
  id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: string;
  price: number;
  discount_amount: number;
}

export interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  created_at: string;
  is_active: boolean | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
}

// Obtener perfil básico del cliente
export async function getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_overview")
    .select("id, full_name, phone, avatar_url, is_active, subscription_status, subscription_end_date")
    .eq("id", customerId)
    .single();

  if (error || !data) {
    console.error("Error fetching customer profile:", error);
    return null;
  }

  // Obtener email desde auth.users
  const email = await getUserEmail(customerId);

  // Obtener fecha de creación del perfil
  const { data: profile } = await supabase.from("profiles").select("created_at").eq("id", customerId).single();

  return {
    ...data,
    email: email || "",
    created_at: profile?.created_at || null,
    is_active: data.is_active,
    subscription_status: data.subscription_status,
    subscription_end_date: data.subscription_end_date,
  };
}

// Obtener KPIs del cliente
export async function getCustomerKPIs(customerId: string): Promise<CustomerHistoryKPIs> {
  const supabase = await createClient();

  // Total gastado - intentar desde payments, fallback a suscripciones
  let totalSpent = 0;
  const { data: paymentsData, error: paymentsError } = await supabase
    .from("payments")
    .select("amount_paid")
    .eq("user_id", customerId);

  if (paymentsError) {
    // Fallback: calcular desde suscripciones
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("discount_amount, plans!inner(price)")
      .eq("user_id", customerId);

    totalSpent =
      subs?.reduce((sum, s) => {
        const price = (s.plans as any)?.price || 0;
        const discount = s.discount_amount || 0;
        return sum + (price - discount);
      }, 0) || 0;
  } else {
    totalSpent = paymentsData?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
  }

  // Fecha de creación de cuenta
  const { data: profileData } = await supabase.from("profiles").select("created_at").eq("id", customerId).single();

  // Total de visitas - manejar si la tabla no existe
  let totalVisits = 0;
  const { count, error: accessError } = await supabase
    .from("access_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", customerId);

  if (!accessError) {
    totalVisits = count || 0;
  }

  // Peso inicial y actual
  const { data: assessments } = await supabase
    .from("body_assessments")
    .select("weight_kg, date")
    .eq("user_id", customerId)
    .order("date", { ascending: true });

  const initialWeight = assessments?.[0]?.weight_kg || null;
  const currentWeight = assessments?.[assessments.length - 1]?.weight_kg || null;
  const weightChange = initialWeight && currentWeight ? currentWeight - initialWeight : null;

  return {
    totalSpent,
    memberSince: profileData?.created_at || null,
    totalVisits,
    initialWeight,
    currentWeight,
    weightChange,
  };
}

// Obtener historial de accesos
export async function getAccessHistory(customerId: string, limit = 50): Promise<AccessLogEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("access_logs")
    .select("id, check_in_time, status")
    .eq("user_id", customerId)
    .order("check_in_time", { ascending: false })
    .limit(limit);

  if (error) {
    // Silenciar si la tabla no existe
    if (error.code !== "42P01") {
      console.error("Error fetching access logs:", error.message);
    }
    return [];
  }

  return (data || []).map((log) => {
    const date = new Date(log.check_in_time);
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return {
      id: log.id,
      check_in_time: log.check_in_time,
      day_of_week: days[date.getDay()],
      status: log.status || "authorized",
    };
  });
}

// Obtener historial de pagos - Si no existe tabla payments, usar suscripciones como fuente
export async function getPaymentHistory(customerId: string): Promise<PaymentEntry[]> {
  const supabase = await createClient();

  // Obtener de la tabla payments con las columnas correctas
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      id,
      payment_date,
      amount_original,
      discount_amount,
      amount_paid,
      method,
      subscription_id,
      subscriptions (
        status,
        start_date,
        end_date,
        plan_id,
        plans (
          name
        )
      )
    `,
    )
    .eq("user_id", customerId)
    .order("payment_date", { ascending: false });

  // Si la tabla no existe o hay error, intentar construir desde suscripciones
  if (error) {
    // Silenciar el error si es porque la tabla no existe
    if (error.code !== "42P01") {
      console.error("Error fetching payment history:", error.message);
    }

    // Fallback: construir historial desde suscripciones
    const { data: subs } = await supabase
      .from("subscriptions")
      .select(
        `
        id,
        start_date,
        end_date,
        status,
        discount_amount,
        created_at,
        plans!inner (
          name,
          price
        )
      `,
      )
      .eq("user_id", customerId)
      .order("created_at", { ascending: false });

    if (!subs) return [];

    return subs.map((sub) => ({
      id: sub.id,
      payment_date: sub.created_at,
      plan_name: (sub.plans as any)?.name || "N/A",
      amount_original: (sub.plans as any)?.price || 0,
      amount_paid: ((sub.plans as any)?.price || 0) - (sub.discount_amount || 0),
      discount_applied: sub.discount_amount || 0,
      payment_method: "N/A",
      subscription_status: sub.status,
      subscription_start: sub.start_date,
      subscription_end: sub.end_date,
    }));
  }

  return (data || []).map((payment) => {
    const subscription = Array.isArray(payment.subscriptions) ? payment.subscriptions[0] : payment.subscriptions;
    const plan = Array.isArray(subscription?.plans) ? subscription?.plans[0] : subscription?.plans;

    return {
      id: payment.id,
      payment_date: payment.payment_date,
      plan_name: plan?.name || "N/A",
      amount_original: payment.amount_original || 0,
      amount_paid: payment.amount_paid || 0,
      discount_applied: payment.discount_amount || 0,
      payment_method: payment.method || "cash",
      subscription_status: subscription?.status || "N/A",
      subscription_start: subscription?.start_date || "",
      subscription_end: subscription?.end_date || "",
    };
  });
}

// Obtener historial de suscripciones
export async function getSubscriptionHistory(customerId: string): Promise<SubscriptionEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      start_date,
      end_date,
      status,
      discount_amount,
      plan_id,
      plans!inner (
        name,
        price
      )
    `,
    )
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching subscription history:", error);
    return [];
  }

  return (data || []).map((sub) => ({
    id: sub.id,
    plan_name: (sub.plans as any)?.name || "N/A",
    start_date: sub.start_date,
    end_date: sub.end_date,
    status: sub.status,
    price: (sub.plans as any)?.price || 0,
    discount_amount: sub.discount_amount || 0,
  }));
}

// Obtener historial de evaluaciones físicas
export async function getBodyAssessmentHistory(customerId: string): Promise<BodyAssessmentEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("body_assessments")
    .select(
      `
      id, 
      user_id, 
      date, 
      weight_kg, 
      height_cm, 
      body_fat_percentage,
      muscle_mass_kg,
      body_type,
      chest,
      waist,
      arm_right,
      notes
    `,
    )
    .eq("user_id", customerId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching body assessments:", error);
    return [];
  }

  return (data || []).map((assessment) => ({
    id: assessment.id,
    assessment_date: assessment.date,
    weight_kg: assessment.weight_kg,
    height_cm: assessment.height_cm,
    body_fat_percentage: assessment.body_fat_percentage,
    muscle_mass: assessment.muscle_mass_kg,
    waist_cm: assessment.waist,
    chest_cm: assessment.chest,
    arm_cm: assessment.arm_right,
    body_type: assessment.body_type,
    notes: assessment.notes,
  }));
}

// Obtener datos para el calendario de calor (últimos 12 meses)
export async function getAccessHeatmapData(customerId: string): Promise<Record<string, number>> {
  const supabase = await createClient();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data, error } = await supabase
    .from("access_logs")
    .select("check_in_time")
    .eq("user_id", customerId)
    .gte("check_in_time", oneYearAgo.toISOString());

  if (error) {
    // Silenciar si la tabla no existe
    if (error.code !== "42P01") {
      console.error("Error fetching heatmap data:", error.message);
    }
    return {};
  }

  // Agrupar por fecha (YYYY-MM-DD)
  const heatmap: Record<string, number> = {};
  (data || []).forEach((log) => {
    const date = log.check_in_time.split("T")[0];
    heatmap[date] = (heatmap[date] || 0) + 1;
  });

  return heatmap;
}
