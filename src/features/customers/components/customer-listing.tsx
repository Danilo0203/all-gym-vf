import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerTable } from "./customer-tables/customer-table";
import { Customer } from "./customer-tables/columns";
import { searchParamsCache } from "@/lib/searchparams";

export default async function CustomerListingPage() {
  const page = searchParamsCache.get("page");
  const pageLimit = searchParamsCache.get("perPage");
  const fullName = searchParamsCache.get("full_name");
  const planName = searchParamsCache.get("plan_name");
  const status = searchParamsCache.get("status");
  const role = searchParamsCache.get("role") || "client";
  const sort = searchParamsCache.get("sort"); // Expecting format: "column.dir" (e.g., "full_name.asc")

  const filters = {
    page,
    limit: pageLimit,
    role,
    ...(fullName && { full_name: fullName }),
    ...(planName && { plan_name: planName }),
    ...(status && { status }),
  };

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Actualizar automáticamente suscripciones vencidas en la BD
  // Esto marca como 'expired' cualquier suscripción cuya end_date haya pasado
  await supabase
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("end_date", new Date().toISOString().split("T")[0]);

  // Obtener la lista de planes para el filtro
  const { data: plans } = await supabase.from("plans").select("id, name").order("name");

  // Crear opciones para el filtro multiSelect
  const planOptions = (plans || []).map((plan) => ({
    label: plan.name,
    value: plan.name,
  }));

  // Query para clientes
  let query = supabase
    .from("customer_overview")
    .select(
      "id, full_name, phone, avatar_url, role, subscription_status, subscription_start_date, subscription_end_date, plan_name, last_check_in, is_active",
      { count: "exact" },
    );

  if (filters.role) {
    query = query.eq("role", filters.role);
  }

  if (filters.full_name) {
    query = query.ilike("full_name", `%${filters.full_name}%`);
  }

  // Filtro por estado (Active/Inactive)
  if (filters.status) {
    // Si el filtro es "Active", buscamos is_active = true
    // Si es "Inactive", buscamos is_active = false
    const statusValues = filters.status.split(",");
    if (statusValues.length === 1) {
      query = query.eq("is_active", statusValues[0] === "Active");
    } else if (statusValues.length > 1) {
      // Si hay múltiples (ej. Active,Inactive), filtramos por ambos (o sea, todos)
      // Pero si la lógica requiere OR, `in` funciona.
      // Convertimos "Active" -> true, "Inactive" -> false
      const boolValues = statusValues.map((s) => s === "Active");
      query = query.in("is_active", boolValues);
    }
  }

  // Filtro por plan (puede ser múltiple, separado por comas)
  if (filters.plan_name) {
    const planNames = filters.plan_name.split(",");
    query = query.in("plan_name", planNames);
  }

  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  // Sorting
  const allowedSortColumns = new Set([
    "full_name",
    "is_active",
    "subscription_status",
    "plan_name",
    "subscription_start_date",
    "subscription_end_date",
    "phone",
    "last_check_in",
  ]);
  let hasAppliedSort = false;
  if (sort && sort.length > 0) {
    sort.forEach((s) => {
      if (allowedSortColumns.has(s.id)) {
        query = query.order(s.id, { ascending: !s.desc, nullsFirst: false });
        hasAppliedSort = true;
      }
    });
  }

  if (!hasAppliedSort) {
    query = query.order("subscription_status", { ascending: true });
  }

  query = query.range(from, to);

  const { data: customers, error, count } = await query;

  if (error) {
    console.error("Error fetching customers (view):", error);
  }

  const totalitems = count || 0;
  const customerRows = ((customers as Customer[]) || []).filter(Boolean);
  const customerIds = customerRows.map((customer) => customer.id);

  let enrichedCustomers = customerRows;

  if (customerIds.length > 0) {
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, biometric_id")
      .in("id", customerIds);

    if (profilesError) {
      console.error("Error fetching customer biometric ids:", profilesError);
    } else {
      const biometricIdByCustomerId = new Map(
        (profiles || []).map((profile) => [profile.id, profile.biometric_id as number | null]),
      );

      const biometricIds = Array.from(
        new Set(
          (profiles || [])
            .map((profile) => profile.biometric_id)
            .filter((value): value is number => Number.isInteger(value)),
        ),
      );

      if (biometricIds.length > 0) {
        const { data: attendanceRows, error: attendanceError } = await adminClient
          .from("attendance_logs")
          .select("biometric_id, punch_time, status1")
          .in("biometric_id", biometricIds)
          .order("punch_time", { ascending: false });

        if (attendanceError && attendanceError.code !== "42P01") {
          console.error("Error fetching latest attendance logs:", attendanceError);
        } else if (attendanceRows) {
          const latestAttendanceByBiometricId = new Map<number, string>();

          for (const row of attendanceRows) {
            if (row.status1 != null && row.status1 !== 0) {
              continue;
            }
            if (!latestAttendanceByBiometricId.has(row.biometric_id)) {
              latestAttendanceByBiometricId.set(row.biometric_id, row.punch_time);
            }
          }

          enrichedCustomers = customerRows.map((customer) => {
            const biometricId = biometricIdByCustomerId.get(customer.id);
            const latestAttendance =
              biometricId != null
                ? latestAttendanceByBiometricId.get(biometricId) || null
                : null;

            return {
              ...customer,
              biometric_id: biometricId ?? null,
              last_check_in: latestAttendance || customer.last_check_in || null,
            };
          });
        }
      }
    }
  }

  return <CustomerTable data={enrichedCustomers} totalItems={totalitems} planOptions={planOptions} />;
}
