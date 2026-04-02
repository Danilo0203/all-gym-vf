"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { ClientErrorState, ClientLoadingState } from "@/features/client/components/client-resource-state";
import { ClientSyncStatus } from "@/features/client/components/client-sync-status";
import { useClientMembership } from "@/features/client/hooks/use-client-api";

function formatDate(value: string | null | undefined) {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "d MMM yyyy", { locale: es });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 2,
  }).format(value);
}

export function ClientMembershipScreen() {
  const membershipQuery = useClientMembership();

  if (membershipQuery.isPending) {
    return <ClientLoadingState title="Cargando el estado de tu membresía..." />;
  }

  if (membershipQuery.isError) {
    return (
      <ClientErrorState
        title="No fue posible cargar tu membresía"
        description="Intenta nuevamente cuando tengas conexión."
      />
    );
  }

  const { data, meta } = membershipQuery.data;
  const overview = data.overview;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <ClientSyncStatus meta={meta} />
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight">Tu membresía</h2>
          <p className="text-sm text-muted-foreground">
            Consulta tu estado actual, el plan asignado y las renovaciones más recientes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border/70">
          <CardHeader>
            <CardDescription>Estado actual</CardDescription>
            <CardTitle className="text-base">Acceso</CardTitle>
          </CardHeader>
          <CardContent>
            <SubscriptionStatusBadge status={overview?.subscription_status} endDate={overview?.subscription_end_date} />
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardHeader>
            <CardDescription>Plan activo</CardDescription>
            <CardTitle className="text-base">{overview?.plan_name || "Sin plan asignado"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Inicio: {formatDate(overview?.subscription_start_date)}
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardHeader>
            <CardDescription>Vencimiento</CardDescription>
            <CardTitle className="text-base">{formatDate(overview?.subscription_end_date)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Último check-in: {formatDate(overview?.last_check_in)}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Historial de membresías</CardTitle>
          <CardDescription>Tus renovaciones y planes más recientes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay membresías registradas en tu cuenta.</p>
          ) : (
            data.subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="flex flex-col gap-3 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-semibold">{subscription.plan_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(subscription.start_date)} - {formatDate(subscription.end_date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <SubscriptionStatusBadge status={subscription.status} endDate={subscription.end_date} />
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatCurrency(subscription.price - subscription.discount_amount)}</p>
                    {subscription.discount_amount > 0 ? (
                      <p className="text-xs text-muted-foreground">Descuento: {formatCurrency(subscription.discount_amount)}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
