"use client";

import { gsap } from "gsap";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconCash,
  IconClock,
  IconCreditCard,
  IconDoorExit,
  IconLogin2,
  IconRefresh,
  IconTransfer,
  IconTrendingUp,
  IconUserPlus,
  IconWallet,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ReversePaymentDialog } from "@/features/cash/components/reverse-payment-dialog";
import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet";
import { closeCashSession, type CashDashboardData, openCashSession } from "@/features/cash/actions/cash-actions";
import { CashCustomerPaymentDialog } from "@/features/cash/components/cash-customer-payment-dialog";
import { cn } from "@/lib/utils";

function formatMoney(amount: number | null | undefined) {
  const safeAmount = typeof amount === "number" ? amount : 0;
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(safeAmount);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(value));
}

function getSessionStatusBadgeVariant(status: string) {
  switch (status) {
    case "open":
      return "default";
    case "closed":
      return "secondary";
    case "closed_with_difference":
      return "destructive";
    default:
      return "outline";
  }
}

function getSessionStatusLabel(status: string) {
  switch (status) {
    case "open":
      return "Abierta";
    case "closed":
      return "Cerrada";
    case "closed_with_difference":
      return "Cerrada con diferencia";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

function getMovementTypeLabel(type: string) {
  switch (type) {
    case "sale":
      return "Cobro";
    case "manual_income":
      return "Ingreso manual";
    case "withdrawal":
      return "Retiro";
    case "refund":
      return "Reembolso";
    case "adjustment":
      return "Ajuste";
    case "void":
      return "Anulación";
    default:
      return type.replaceAll("_", " ");
  }
}

function getPaymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case "cash":
      return "Efectivo";
    case "card":
      return "Tarjeta";
    case "transfer":
      return "Transferencia";
    default:
      return "No aplica";
  }
}

function getMovementConceptLabel(category: string, note: string | null | undefined, type: string) {
  if (note?.trim()) {
    return note.trim();
  }

  if (type === "manual_income") {
    return "Ingreso operativo";
  }

  if (type === "withdrawal") {
    return "Salida de efectivo";
  }

  switch (category) {
    case "membership":
      return "Membresía";
    case "product":
      return "Producto";
    case "enrollment":
      return "Inscripción";
    case "service":
      return "Servicio";
    default:
      return "Movimiento de caja";
  }
}

function getActivityStatusVariant(movement: CashDashboardData["activityMovements"][number]) {
  if (movement.voided_at || movement.movement_type === "void") {
    return "destructive";
  }

  if (movement.source_payment_status === "reversed") {
    return "warning";
  }

  if (movement.session_link_status === "out_of_session") {
    return "warning";
  }

  return "success";
}

function getActivityStatusLabel(movement: CashDashboardData["activityMovements"][number]) {
  if (movement.voided_at || movement.movement_type === "void") {
    return "Anulado";
  }

  if (movement.source_payment_status === "reversed") {
    return "Revertido";
  }

  if (movement.session_link_status === "out_of_session") {
    return "Fuera de sesión";
  }

  return "Registrado";
}

function canReverseMovement(
  movement: CashDashboardData["activityMovements"][number],
  role: CashDashboardData["access"]["role"],
) {
  return (
    role === "admin" &&
    movement.movement_type === "sale" &&
    Boolean(movement.source_payment_id) &&
    !movement.voided_at &&
    movement.source_payment_status !== "reversed"
  );
}

function SummarySessionCard({
  sessionNumber,
  status,
  registerName,
  openedAt,
  openedByName,
}: {
  sessionNumber: string;
  status: string;
  registerName: string;
  openedAt: string;
  openedByName: string;
}) {
  return (
    <div data-summary-card className="rounded-[24px] border border-border/70 bg-muted/20 p-4 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getSessionStatusBadgeVariant(status)}>{getSessionStatusLabel(status)}</Badge>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              Caja {registerName}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">Sesión activa</p>
            <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{sessionNumber}</h3>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[540px]">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">Cajero</p>
            <p className="mt-2 text-sm font-semibold tracking-tight sm:text-base">{openedByName}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">Apertura</p>
            <p className="mt-2 text-sm font-semibold tracking-tight sm:text-base">{formatDateTime(openedAt)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">Estado</p>
            <p className="mt-2 text-sm font-semibold tracking-tight sm:text-base">{getSessionStatusLabel(status)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  helper,
  icon,
  className,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  className?: string;
  tone?: "default" | "success" | "accent";
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-500/20 bg-[linear-gradient(180deg,hsl(var(--background)),rgba(16,185,129,0.04))]"
      : tone === "accent"
        ? "border-primary/20 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--primary)/0.04))]"
        : "border-border/70 bg-background/80";

  return (
    <div
      data-summary-card
      className={cn(
        "group rounded-[22px] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5",
        toneClassName,
        className,
      )}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <p className="text-[0.68rem] uppercase tracking-[0.28em]">{label}</p>
        </div>

        <div className="space-y-2">
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {helper ? <p className="max-w-[26ch] text-sm leading-6 text-muted-foreground">{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

function FinancialRow({ label, amount, icon }: { label: string; amount: number | null | undefined; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{formatMoney(amount)}</strong>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description: string;
  tone?: "default" | "primary" | "danger";
  children: ReactNode;
}) {
  const toneClassName =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "danger"
        ? "border-destructive/30 bg-destructive/5"
        : "bg-background/40";

  return (
    <div className={`rounded-xl border p-4 ${toneClassName}`}>
      <div className="space-y-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function CashDashboardClient({ data }: { data: CashDashboardData }) {
  const router = useRouter();
  const summaryCardsRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openingAmount, setOpeningAmount] = useState("0.00");
  const [openingNotes, setOpeningNotes] = useState("");
  const [countedAmount, setCountedAmount] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const handleAction = (task: () => Promise<void>, successMessage: string) => {
    startTransition(async () => {
      try {
        await task();
        toast.success(successMessage);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo completar la acción");
      }
    });
  };

  const onOpenSession = () => {
    if (!data.register) {
      toast.error("No hay una caja disponible");
      return;
    }

    handleAction(async () => {
      await openCashSession(data.register!.id, Number(openingAmount || 0), openingNotes);
      setOpeningNotes("");
    }, "Caja abierta correctamente");
  };

  const expectedAmount = data.summary?.expectedAmount || 0;
  const countedDifference =
    countedAmount.trim().length > 0 && Number.isFinite(Number(countedAmount))
      ? Number(countedAmount) - expectedAmount
      : null;
  const requiresClosingNote = countedDifference !== null && Math.abs(countedDifference) > 0.009;

  useEffect(() => {
    const container = summaryCardsRef.current;
    if (!container || !data.currentSession) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const cards = container.querySelectorAll<HTMLElement>("[data-summary-card]");
      if (cards.length === 0) return;

      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          overwrite: "auto",
        },
      );
    });

    return () => media.revert();
  }, [data.currentSession]);

  const onCloseSession = () => {
    if (!data.currentSession) return;
    if (requiresClosingNote && !closingNote.trim()) {
      toast.error("Debes registrar una observación cuando exista diferencia al cerrar la caja.");
      return;
    }

    handleAction(async () => {
      await closeCashSession(data.currentSession!.id, Number(countedAmount || 0), closingNote);
      setCloseDialogOpen(false);
      setCountedAmount("");
      setClosingNote("");
    }, "Caja cerrada correctamente");
  };

  if (!data.currentSession) {
    return (
      <div className="space-y-6">
        {!data.register ? (
          <Card>
            <CardHeader>
              <CardTitle>Caja no disponible</CardTitle>
              <CardDescription>No existe una caja activa configurada en el sistema.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2">
              <IconLogin2 className="h-5 w-5" />
              Apertura de caja
            </CardTitle>
            <CardDescription>
              Registra el fondo inicial y habilita el centro operativo del turno para cobros, renovaciones y control de
              movimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 py-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Caja</p>
                  <p className="mt-2 text-lg font-semibold">{data.register?.name || "Sin caja activa"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Solo se mostrará la operación del turno cuando la caja esté abierta.
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Acceso operativo</p>
                  <p className="mt-2 text-lg font-semibold capitalize">{data.access.role}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    La apertura habilita cobros, renovaciones, ingresos manuales y cierre.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <IconAlertCircle className="mt-0.5 h-4 w-4" />
                  <p>
                    La pantalla operativa completa aparecerá después de abrir la caja. Ahí se mostrarán acciones rápidas
                    de cobro, actividad del turno y cierre.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-background/60 p-5">
              <div className="space-y-1">
                <p className="text-sm font-medium">Configurar apertura</p>
                <p className="text-sm text-muted-foreground">
                  Ingresa el fondo inicial y una observación opcional para el turno.
                </p>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                placeholder="0.00"
              />
              <Textarea
                rows={4}
                value={openingNotes}
                onChange={(event) => setOpeningNotes(event.target.value)}
                placeholder="Observación opcional de apertura"
              />
              <Button
                className="w-full"
                disabled={isPending || !data.canOpenSession || !data.register}
                onClick={onOpenSession}
              >
                <IconLogin2 className="h-4 w-4" />
                Abrir caja
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
        <CardContent className="py-6">
          <div ref={summaryCardsRef} className="space-y-4">
            <SummarySessionCard
              sessionNumber={data.currentSession.session_number}
              status={data.currentSession.status}
              registerName={data.currentSession.cash_register_name}
              openedAt={data.currentSession.opened_at}
              openedByName={data.currentSession.opened_by_name || "Usuario"}
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <KpiTile
                label="Fondo inicial"
                value={formatMoney(data.summary?.openingAmount)}
                helper="Monto base de la sesión."
                icon={<IconCash className="h-4 w-4" />}
              />
              <KpiTile
                label="Efectivo esperado"
                value={formatMoney(data.summary?.expectedAmount)}
                helper="Disponible estimado antes del cierre."
                icon={<IconWallet className="h-4 w-4" />}
                tone="accent"
              />
              <KpiTile
                label="Ventas"
                value={`${data.summary?.salesCount || 0}`}
                helper={`${formatMoney(data.summary?.totalsByMethod.cash)} efectivo y ${formatMoney((data.summary?.totalsByMethod.card || 0) + (data.summary?.totalsByMethod.transfer || 0))} en otros métodos.`}
                icon={<IconTrendingUp className="h-4 w-4" />}
                tone="success"
              />
              <KpiTile
                label="Movimientos"
                value={`${data.sessionMovements.length}`}
                helper={`${data.outOfSessionMovements.length} fuera de sesión hoy.`}
                icon={<IconTransfer className="h-4 w-4" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {data.outOfSessionMovements.length > 0 ? (
        <Alert className="border-amber-300 bg-amber-50/60 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
          <IconAlertCircle className="h-4 w-4" />
          <AlertTitle>Hay pagos fuera de sesión</AlertTitle>
          <AlertDescription>
            Se detectaron {data.outOfSessionMovements.length} movimientos registrados sin caja abierta. Ya aparecen en
            la actividad del turno para seguimiento manual.
          </AlertDescription>
        </Alert>
      ) : null}

      {!data.canOperateSession ? (
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertTitle>Sesión abierta por otro usuario</AlertTitle>
          <AlertDescription>
            Esta caja está siendo operada por {data.currentSession.opened_by_name}. Solo un administrador puede
            intervenir en esta sesión.
          </AlertDescription>
        </Alert>
      ) : null}

      {data.canOperateSession ? (
        <Card>
          <CardHeader>
            <CardTitle>Acciones rápidas de caja</CardTitle>
            <CardDescription>
              La sesión está abierta. Usa estos accesos para cobrar, renovar y registrar movimientos operativos del
              turno.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <QuickActionCard
              title="Nuevo cliente + cobro"
              description="Registra una alta nueva, asigna plan y cobra dentro de la sesión actual."
              tone="primary"
            >
              <CustomerFormSheet
                entrypoint="cash"
                trigger={
                  <Button className="w-full">
                    <IconUserPlus className="h-4 w-4" />
                    Nuevo cliente + cobro
                  </Button>
                }
              />
            </QuickActionCard>

            <QuickActionCard
              title="Renovar suscripción"
              description="Busca al cliente, revisa su contexto y continúa con la renovación rápida."
            >
              <CashCustomerPaymentDialog
                mode="renewal"
                trigger={
                  <Button className="w-full" variant="outline">
                    <IconRefresh className="h-4 w-4" />
                    Renovar suscripción
                  </Button>
                }
              />
            </QuickActionCard>

            <QuickActionCard
              title="Cerrar caja"
              description="Confirma el contado real y registra la diferencia si existe."
              tone="danger"
            >
              <Button className="w-full" variant="destructive" onClick={() => setCloseDialogOpen(true)}>
                <IconDoorExit className="h-4 w-4" />
                Cerrar caja
              </Button>
            </QuickActionCard>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Actividad del turno</CardTitle>
            <CardDescription>
              Incluye cobros, renovaciones, movimientos manuales y registros fuera de sesión del día.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {data.activityMovements.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Aún no hay actividad registrada en este turno.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Usuario</TableHead>
                      {data.access.role === "admin" ? <TableHead className="text-right">Acciones</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.activityMovements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(movement.created_at)}</TableCell>
                        <TableCell>{getMovementTypeLabel(movement.movement_type)}</TableCell>
                        <TableCell>{movement.customer_name || "Operación de caja"}</TableCell>
                        <TableCell>
                          {getMovementConceptLabel(movement.category, movement.note, movement.movement_type)}
                        </TableCell>
                        <TableCell>{getPaymentMethodLabel(movement.payment_method)}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{formatMoney(movement.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={getActivityStatusVariant(movement)}>{getActivityStatusLabel(movement)}</Badge>
                        </TableCell>
                        <TableCell>{movement.created_by_name || "Usuario"}</TableCell>
                        {data.access.role === "admin" ? (
                          <TableCell className="text-right">
                            {canReverseMovement(movement, data.access.role) && movement.source_payment_id ? (
                              <ReversePaymentDialog
                                paymentId={movement.source_payment_id}
                                sourceCategory={movement.category}
                                conceptLabel={getMovementConceptLabel(movement.category, movement.note, movement.movement_type)}
                                trigger={
                                  <Button variant="outline" size="sm">
                                    <IconArrowsExchange className="h-4 w-4" />
                                    Reversar cobro
                                  </Button>
                                }
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Control financiero</CardTitle>
              <CardDescription>Resumen por método y referencia del esperado antes del cierre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FinancialRow
                label="Efectivo"
                amount={data.summary?.totalsByMethod.cash}
                icon={<IconCash className="h-4 w-4" />}
              />
              <FinancialRow
                label="Tarjeta"
                amount={data.summary?.totalsByMethod.card}
                icon={<IconCreditCard className="h-4 w-4" />}
              />
              <FinancialRow
                label="Transferencia"
                amount={data.summary?.totalsByMethod.transfer}
                icon={<IconTransfer className="h-4 w-4" />}
              />
              <FinancialRow
                label="Efectivo esperado"
                amount={data.summary?.expectedAmount}
                icon={<IconWallet className="h-4 w-4" />}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={closeDialogOpen}
        onOpenChange={(nextOpen) => {
          setCloseDialogOpen(nextOpen);
          if (!nextOpen && !isPending) {
            setCountedAmount("");
            setClosingNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cierre de caja</DialogTitle>
            <DialogDescription>
              Ingresa el efectivo contado real. Si hay diferencia, la observación será obligatoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Esperado</p>
                <p className="mt-2 text-xl font-semibold">{formatMoney(expectedAmount)}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Diferencia estimada</p>
                <p
                  className={`mt-2 text-xl font-semibold ${requiresClosingNote ? "text-destructive" : "text-emerald-600"}`}
                >
                  {countedDifference === null ? formatMoney(0) : formatMoney(countedDifference)}
                </p>
              </div>
            </div>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={countedAmount}
              onChange={(event) => setCountedAmount(event.target.value)}
              placeholder="Efectivo contado"
            />
            <Textarea
              rows={4}
              value={closingNote}
              onChange={(event) => setClosingNote(event.target.value)}
              placeholder="Observación de cierre. Será obligatoria si existe diferencia."
            />

            {requiresClosingNote ? (
              <Alert variant="destructive">
                <IconAlertCircle className="h-4 w-4" />
                <AlertTitle>Debes justificar la diferencia</AlertTitle>
                <AlertDescription>
                  El contado real difiere del efectivo esperado. Registra una observación antes de cerrar la caja.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <IconClock className="h-4 w-4" />
                <AlertTitle>Cierre listo para confirmar</AlertTitle>
                <AlertDescription>Si el contado es correcto, puedes cerrar la caja con este monto.</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setCloseDialogOpen(false);
                  setCountedAmount("");
                  setClosingNote("");
                }}
              >
                Cancelar
              </Button>
              <Button
                className="min-w-40"
                variant="destructive"
                disabled={isPending || !countedAmount}
                onClick={onCloseSession}
              >
                <IconDoorExit className="h-4 w-4" />
                Cerrar caja
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
