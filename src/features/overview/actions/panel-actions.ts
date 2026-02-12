"use server";

import { createClient } from "@/lib/supabase/server";
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays, addDays } from "date-fns";
import { es } from "date-fns/locale";

// ====================
// TIPOS
// ====================
export interface DashboardKPIs {
  totalRevenue: number;
  revenueChange: number;
  activeMembers: number;
  inactiveMembers: number;
  churnRate: number;
  avgTicket: number;
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
}

export interface RevenueByMonth {
  month: string;
  revenue: number;
}

export interface PlanDistribution {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RecentPayment {
  id: number;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  plan_name: string;
  amount: number;
  method: "cash" | "card" | "transfer";
  date: string;
}

export interface ExpiringSubscription {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  phone: string | null;
  plan_name: string;
  end_date: string;
  days_left: number;
}

export interface InactiveCustomer {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  phone: string | null;
  last_plan: string;
  expired_date: string;
  days_inactive: number;
}

export interface SubscriptionsFlow {
  month: string;
  newSubs: number;
  cancelled: number;
}

export interface PaymentMethodDistribution {
  method: string;
  amount: number;
  count: number;
  color: string;
}

// Interfaz para rango de fechas del dashboard
export interface DashboardDateRange {
  from: string; // ISO date string (YYYY-MM-DD)
  to: string; // ISO date string (YYYY-MM-DD)
}

// ====================
// FUNCIONES PRINCIPALES
// ====================

export async function getDashboardKPIs(dateRange?: DashboardDateRange): Promise<DashboardKPIs> {
  const supabase = await createClient();
  const now = new Date();

  // Usar el rango proporcionado o el mes actual por defecto
  const periodStart = dateRange?.from ? new Date(dateRange.from + "T00:00:00") : startOfMonth(now);
  const periodEnd = dateRange?.to ? new Date(dateRange.to + "T23:59:59") : endOfMonth(now);

  // Para comparativa, usar el período anterior equivalente
  const periodDuration = periodEnd.getTime() - periodStart.getTime();
  const prevPeriodEnd = new Date(periodStart.getTime() - 1);
  const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

  // 1. Ingresos del período seleccionado
  const { data: currentPayments } = await supabase
    .from("payments")
    .select("amount_paid, method")
    .gte("payment_date", periodStart.toISOString())
    .lte("payment_date", periodEnd.toISOString());

  const totalRevenue = currentPayments?.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
  const cashAmount =
    currentPayments?.filter((p) => p.method === "cash").reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
  const cardAmount =
    currentPayments?.filter((p) => p.method === "card").reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
  const transferAmount =
    currentPayments?.filter((p) => p.method === "transfer").reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) ||
    0;

  // 2. Ingresos del período anterior (para comparativa)
  const { data: prevPeriodPayments } = await supabase
    .from("payments")
    .select("amount_paid")
    .gte("payment_date", prevPeriodStart.toISOString())
    .lte("payment_date", prevPeriodEnd.toISOString());

  const prevPeriodRevenue = prevPeriodPayments?.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
  const revenueChange =
    prevPeriodRevenue > 0 ? ((totalRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100 : totalRevenue > 0 ? 100 : 0;

  // 3. Miembros activos e inactivos (contar USUARIOS ÚNICOS, no suscripciones)
  // Un usuario es ACTIVO si tiene al menos 1 suscripción activa
  // Un usuario es INACTIVO si NO tiene ninguna suscripción activa

  // Obtener usuarios con suscripción activa (únicos)
  const { data: activeSubscriptions } = await supabase.from("subscriptions").select("user_id").eq("status", "active");

  const activeUserIds = new Set(activeSubscriptions?.map((s) => s.user_id) || []);
  const activeCount = activeUserIds.size;

  // Obtener todos los usuarios que tienen suscripciones (para calcular inactivos)
  const { data: allSubscriptions } = await supabase.from("subscriptions").select("user_id");

  const allUserIds = new Set(allSubscriptions?.map((s) => s.user_id) || []);

  // Usuarios inactivos = usuarios con suscripciones pero SIN ninguna activa
  const inactiveUserIds = Array.from(allUserIds).filter((id) => !activeUserIds.has(id));
  const inactiveCount = inactiveUserIds.length;

  // 4. Churn rate (usuarios que pasaron a inactivo en este período)
  // Contar usuarios ÚNICOS cuya última suscripción venció en el período Y no tienen otra activa
  const { data: churnedSubscriptions } = await supabase
    .from("subscriptions")
    .select("user_id")
    .in("status", ["expired", "cancelled"])
    .gte("end_date", periodStart.toISOString().split("T")[0])
    .lte("end_date", periodEnd.toISOString().split("T")[0]);

  // Filtrar solo usuarios que NO tienen suscripción activa (realmente "churnearon")
  const churnedUserIds = new Set(
    (churnedSubscriptions || []).filter((s) => !activeUserIds.has(s.user_id)).map((s) => s.user_id),
  );
  const churnedThisMonth = churnedUserIds.size;

  const totalMembers = activeCount + churnedThisMonth;
  const churnRate = totalMembers > 0 ? (churnedThisMonth / totalMembers) * 100 : 0;

  // 5. Ticket promedio
  const avgTicket = currentPayments && currentPayments.length > 0 ? totalRevenue / currentPayments.length : 0;

  return {
    totalRevenue,
    revenueChange: Math.round(revenueChange * 10) / 10,
    activeMembers: activeCount || 0,
    inactiveMembers: inactiveCount || 0,
    churnRate: Math.round(churnRate * 10) / 10,
    avgTicket: Math.round(avgTicket * 100) / 100,
    cashAmount,
    cardAmount,
    transferAmount,
  };
}

export async function getRevenueByMonth(): Promise<RevenueByMonth[]> {
  const supabase = await createClient();
  const months: RevenueByMonth[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const { data } = await supabase
      .from("payments")
      .select("amount_paid")
      .gte("payment_date", start.toISOString())
      .lte("payment_date", end.toISOString());

    months.push({
      month: format(date, "MMM", { locale: es }),
      revenue: data?.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0,
    });
  }

  return months;
}

export async function getPlanDistribution(): Promise<PlanDistribution[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("subscriptions")
    .select(
      `
      plan_id,
      plans (name)
    `,
    )
    .eq("status", "active");

  if (!data || data.length === 0) return [];

  // Contar por plan
  const planCounts: Record<string, { name: string; count: number }> = {};

  data.forEach((sub: any) => {
    const planName = sub.plans?.name || "Sin Plan";
    if (!planCounts[planName]) {
      planCounts[planName] = { name: planName, count: 0 };
    }
    planCounts[planName].count++;
  });

  const total = data.length;
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return Object.values(planCounts).map((plan, index) => ({
    name: plan.name,
    count: plan.count,
    percentage: Math.round((plan.count / total) * 100),
    color: colors[index % colors.length],
  }));
}

export async function getRecentPayments(limit: number = 10): Promise<RecentPayment[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select(
      `
      id,
      user_id,
      amount_paid,
      method,
      payment_date,
      subscriptions!inner (
        plans (name)
      ),
      profiles!payments_user_id_fkey (
        full_name,
        avatar_url
      )
    `,
    )
    .order("payment_date", { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((payment: any) => ({
    id: payment.id,
    user_id: payment.user_id,
    user_name: payment.profiles?.full_name || "Usuario",
    avatar_url: payment.profiles?.avatar_url,
    plan_name: payment.subscriptions?.plans?.name || "Plan",
    amount: Number(payment.amount_paid),
    method: payment.method,
    date: payment.payment_date,
  }));
}

export async function getExpiringSubscriptions(daysAhead: number = 5): Promise<ExpiringSubscription[]> {
  const supabase = await createClient();
  const today = new Date();
  const futureDate = addDays(today, daysAhead);

  const { data } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      user_id,
      end_date,
      plans (name),
      profiles!subscriptions_user_id_fkey (
        full_name,
        avatar_url,
        phone
      )
    `,
    )
    .eq("status", "active")
    .gte("end_date", today.toISOString().split("T")[0])
    .lte("end_date", futureDate.toISOString().split("T")[0])
    .order("end_date", { ascending: true });

  if (!data) return [];

  return data.map((sub: any) => {
    const endDate = new Date(sub.end_date);
    return {
      user_id: sub.user_id,
      user_name: sub.profiles?.full_name || "Usuario",
      avatar_url: sub.profiles?.avatar_url,
      phone: sub.profiles?.phone,
      plan_name: sub.plans?.name || "Plan",
      end_date: sub.end_date,
      days_left: differenceInDays(endDate, today),
    };
  });
}

export async function getInactiveCustomers(limit: number = 10): Promise<InactiveCustomer[]> {
  const supabase = await createClient();
  const today = new Date();

  const { data } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      user_id,
      end_date,
      plans (name),
      profiles!subscriptions_user_id_fkey (
        full_name,
        avatar_url,
        phone
      )
    `,
    )
    .in("status", ["expired", "cancelled"])
    .order("end_date", { ascending: false })
    .limit(limit);

  if (!data) return [];

  // Filtrar usuarios que no tienen una suscripción activa
  const uniqueUsers = new Map();

  for (const sub of data) {
    if (!uniqueUsers.has(sub.user_id)) {
      // Verificar si tiene suscripción activa
      const { count } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", sub.user_id)
        .eq("status", "active");

      if (!count || count === 0) {
        const endDate = new Date((sub as any).end_date);
        uniqueUsers.set(sub.user_id, {
          user_id: sub.user_id,
          user_name: (sub as any).profiles?.full_name || "Usuario",
          avatar_url: (sub as any).profiles?.avatar_url,
          phone: (sub as any).profiles?.phone,
          last_plan: (sub as any).plans?.name || "Plan",
          expired_date: (sub as any).end_date,
          days_inactive: differenceInDays(today, endDate),
        });
      }
    }
  }

  return Array.from(uniqueUsers.values()).slice(0, limit);
}

export async function getSubscriptionsFlow(): Promise<SubscriptionsFlow[]> {
  const supabase = await createClient();
  const flow: SubscriptionsFlow[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // Nuevas suscripciones creadas este mes
    const { count: newCount } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    // Suscripciones que vencieron/cancelaron este mes
    const { count: cancelledCount } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .in("status", ["expired", "cancelled"])
      .gte("end_date", start.toISOString().split("T")[0])
      .lte("end_date", end.toISOString().split("T")[0]);

    flow.push({
      month: format(date, "MMM", { locale: es }),
      newSubs: newCount || 0,
      cancelled: cancelledCount || 0,
    });
  }

  return flow;
}

export async function getPaymentMethodDistribution(
  dateRange?: DashboardDateRange,
): Promise<PaymentMethodDistribution[]> {
  const supabase = await createClient();
  const now = new Date();

  const periodStart = dateRange?.from ? new Date(dateRange.from + "T00:00:00") : startOfMonth(now);
  const periodEnd = dateRange?.to ? new Date(dateRange.to + "T23:59:59") : endOfMonth(now);

  const { data } = await supabase
    .from("payments")
    .select("amount_paid, method")
    .gte("payment_date", periodStart.toISOString())
    .lte("payment_date", periodEnd.toISOString());

  if (!data || data.length === 0) return [];

  const methodMap: Record<string, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 },
    card: { amount: 0, count: 0 },
    transfer: { amount: 0, count: 0 },
  };

  data.forEach((payment) => {
    const method = payment.method || "cash";
    if (methodMap[method]) {
      methodMap[method].amount += Number(payment.amount_paid || 0);
      methodMap[method].count++;
    }
  });

  const colors: Record<string, string> = {
    cash: "var(--success)",
    card: "var(--chart-1)",
    transfer: "var(--chart-4)",
  };

  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
  };

  return Object.entries(methodMap)
    .filter(([_, data]) => data.count > 0)
    .map(([method, data]) => ({
      method: labels[method] || method,
      amount: data.amount,
      count: data.count,
      color: colors[method] || "hsl(var(--muted))",
    }));
}
