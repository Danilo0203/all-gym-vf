"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IconCalendar, IconMail, IconPhone, IconUser } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { ClientErrorState, ClientLoadingState } from "@/features/client/components/client-resource-state";
import { ClientSyncStatus } from "@/features/client/components/client-sync-status";
import { useClientProfile } from "@/features/client/hooks/use-client-api";

function formatDate(value: string | null | undefined) {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "d MMM yyyy", { locale: es });
}

function getInitials(name: string | null | undefined) {
  if (!name) return "AG";
  return name
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ClientProfileScreen() {
  const profileQuery = useClientProfile();

  if (profileQuery.isPending) {
    return <ClientLoadingState title="Cargando tu perfil..." />;
  }

  if (profileQuery.isError) {
    return (
      <ClientErrorState
        title="No fue posible cargar tu perfil"
        description="Intenta nuevamente cuando tengas conexión."
      />
    );
  }

  const { data, meta } = profileQuery.data;
  const overview = data.overview;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <ClientSyncStatus meta={meta} />
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight">Tu perfil</h2>
          <p className="text-sm text-muted-foreground">
            Mantén a mano tu información principal y el estado actual de tu cuenta.
          </p>
        </div>
      </div>

      <Card className="border-border/70 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20 border-4 border-background shadow-sm">
            <AvatarImage src={data.avatar_url || ""} alt={data.full_name || "Cliente"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-black">
              {getInitials(data.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black tracking-tight">{data.full_name || "Cliente"}</h3>
              <Badge variant="secondary">Cliente</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <IconMail className="h-4 w-4" />
                {data.email}
              </span>
              {overview?.subscription_status ? (
                <SubscriptionStatusBadge status={overview.subscription_status} endDate={overview.subscription_end_date} />
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
            <CardDescription>Información básica sincronizada desde tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <IconPhone className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Teléfono</p>
                <p className="text-sm text-muted-foreground">{data.phone || "No registrado"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <IconUser className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Género</p>
                <p className="text-sm text-muted-foreground">{data.gender || "No especificado"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <IconCalendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Fecha de nacimiento</p>
                <p className="text-sm text-muted-foreground">{formatDate(data.birth_date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Estado de cuenta</CardTitle>
            <CardDescription>Resumen rápido de tu plan actual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Plan actual</p>
              <p className="text-sm text-muted-foreground">{overview?.plan_name || "Sin plan asignado"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Vigencia</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(overview?.subscription_start_date)} - {formatDate(overview?.subscription_end_date)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Miembro desde</p>
              <p className="text-sm text-muted-foreground">{formatDate(data.created_at)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
