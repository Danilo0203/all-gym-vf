"use client";
import { AlertModal } from "@/components/modal/alert-modal";
import { Button } from "@/components/ui/button";
import { Customer } from "./columns";
import { IconEdit, IconTrash, IconLoader2, IconFingerprint, IconUserOff, IconUserCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CustomerFormSheet, CustomerData } from "../customer-form-sheet";
import {
  deleteCustomer,
  enrollBiometricOnDevice,
  permanentlyDeleteCustomer,
  reactivateCustomer,
} from "../../actions/customer-actions";
import { toast } from "sonner";
import { useCustomer } from "../../hooks/use-customers";
import { Badge } from "@/components/ui/badge";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CellActionProps {
  data: Customer;
}

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
  const [disableLoading, setDisableLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false); // Sheet de edición
  const [biometricOpen, setBiometricOpen] = useState(false);
  const [deviceSn, setDeviceSn] = useState("CN4C232260011");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const router = useRouter();

  // Fetch automático cuando se abre el modal
  const { data: customerDetails, isPending: isPendingDetails } = useCustomer(editOpen ? data.id : null);

  // Combinar datos locales de la tabla con datos detallados del servidor si existen
  const customerToEdit = customerDetails
    ? ({
        ...customerDetails,
        full_name: customerDetails.full_name || data.full_name,
        email: customerDetails.email,
        phone: customerDetails.phone || data.phone,
        is_active: customerDetails.is_active ?? data.is_active,
      } as CustomerData)
    : null;

  const onConfirmDisable = async () => {
    setDisableLoading(true);
    try {
      const result = data.is_active ? await deleteCustomer(data.id) : await reactivateCustomer(data.id);
      if (result.success) {
        const deviceSync = (result as any)?.deviceSync;
        const deviceSynced = deviceSync?.attempted ? deviceSync?.synced === true || deviceSync?.queued === true : null;

        if (data.is_active) {
          if (deviceSynced === false) {
            toast.warning("Cliente desactivado en el sistema, pero falló el envío al reloj.");
          } else {
            toast.success("Cliente desactivado y bloqueado en el reloj.");
          }
        } else if (deviceSynced === false) {
          toast.warning("Cliente reactivado en el sistema, pero falló el envío al reloj.");
        } else {
          toast.success("Cliente reactivado y habilitado en el reloj.");
        }
        router.refresh();
      } else {
        toast.error(result.error || `Error al ${data.is_active ? "desactivar" : "reactivar"} el cliente`);
      }
    } catch (error) {
      toast.error(`Error al ${data.is_active ? "desactivar" : "reactivar"} el cliente`);
    } finally {
      setDisableLoading(false);
      setDisableOpen(false);
    }
  };

  const onConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      const result = await permanentlyDeleteCustomer(data.id);
      if (result.success) {
        toast.success("Cliente eliminado del sistema. El reloj puede tardar unos segundos en reflejarlo.");
        router.refresh();
      } else {
        toast.error(result.error || "Error al eliminar completamente el cliente");
      }
    } catch (error) {
      toast.error("Error al eliminar completamente el cliente");
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  const onEnrollBiometric = async () => {
    const sn = deviceSn.trim();
    if (!sn) {
      toast.error("Ingresa el serial del dispositivo");
      return;
    }
    setBiometricLoading(true);
    try {
      const result = await enrollBiometricOnDevice(data.id, sn);
      if (result.success) {
        toast.success("¡Mira el dispositivo! Debería estar pidiendo el rostro ahora.");
        setBiometricOpen(false);
        setDeviceSn("");
      } else {
        toast.error(result.error || "Error al enviar comando");
      }
    } catch (error) {
      toast.error("Error al enviar comando al dispositivo");
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <AlertModal
        isOpen={disableOpen}
        onClose={() => setDisableOpen(false)}
        onConfirm={onConfirmDisable}
        loading={disableLoading}
        title={data.is_active ? "¿Desactivar cliente?" : "¿Reactivar cliente?"}
        description={
          <div className="space-y-2 mt-2">
            <p>
              {data.is_active ? (
                <>
                  El cliente <span className="font-semibold text-foreground">{data.full_name}</span> pasará a estado
                  inactivo y el reloj ya no permitirá su ingreso.
                </>
              ) : (
                <>
                  El cliente <span className="font-semibold text-foreground">{data.full_name}</span> volverá a estado
                  activo y se habilitará nuevamente en el reloj.
                </>
              )}
            </p>
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="font-medium">Estado:</span>
                <span className="col-span-2">
                  <Badge variant={data.is_active ? "success" : "secondary"}>
                    {data.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </span>

                <span className="font-medium">Suscripción:</span>
                <span className="col-span-2">
                  <SubscriptionStatusBadge status={data.subscription_status} endDate={data.subscription_end_date} />
                </span>

                <span className="font-medium">Teléfono:</span>
                <span className="col-span-2 text-muted-foreground">{data.phone || "N/A"}</span>

                <span className="font-medium">Plan:</span>
                <span className="col-span-2 text-muted-foreground">{data.plan_name || "Sin plan"}</span>

                <span className="font-medium">Vencimiento:</span>
                <span className="col-span-2 text-muted-foreground">
                  {data.subscription_end_date
                    ? new Date(data.subscription_end_date).toLocaleDateString("es-ES")
                    : "N/A"}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {data.is_active
                ? "Podrás reactivarlo más tarde y recuperar su acceso."
                : "Se volverá a sincronizar su acceso con el reloj."}
            </p>
          </div>
        }
        confirmText={data.is_active ? "Desactivar" : "Reactivar"}
      />

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onConfirmDelete}
        loading={deleteLoading}
        title="¿Eliminar cliente completamente?"
        description={
          <div className="space-y-2 mt-2">
            <p>
              El cliente <span className="font-semibold text-foreground">{data.full_name}</span> se eliminará del
              sistema y del reloj.
            </p>
            <p className="text-sm text-destructive">
              Esta acción intenta borrar también sus huellas del dispositivo y no se puede deshacer.
            </p>
            <p className="text-sm text-muted-foreground">
              El reloj procesa la eliminación por cola ADMS, así que puede tardar unos segundos en desaparecer de la
              pantalla del equipo.
            </p>
          </div>
        }
        confirmText="Eliminar completamente"
      />

      <CustomerFormSheet
        mode="edit"
        customer={customerToEdit}
        open={editOpen}
        onOpenChange={setEditOpen}
        trigger={null}
      />

      <Dialog open={biometricOpen} onOpenChange={setBiometricOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar rostro / biometría</DialogTitle>
            <DialogDescription>
              El dispositivo abrirá la cámara para registrar el rostro del cliente. Ingresa el serial del reloj (ej.
              CN4C232260011) y asegúrate de que el cliente esté frente al dispositivo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="device-sn">Serial del dispositivo</Label>
            <Input
              id="device-sn"
              placeholder="CN4C232260011"
              value={deviceSn}
              onChange={(e) => setDeviceSn(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onEnrollBiometric()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBiometricOpen(false)} disabled={biometricLoading}>
              Cancelar
            </Button>
            <Button onClick={onEnrollBiometric} disabled={biometricLoading}>
              {biometricLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar al dispositivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditOpen(true);
                }}
                disabled={editOpen && isPendingDetails}
              >
                {editOpen && isPendingDetails ? (
                  <IconLoader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <IconEdit className="h-4 w-4 text-blue-500" />
                )}
                <span className="sr-only">Editar cliente</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Editar cliente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setBiometricOpen(true);
                }}
              >
                <IconFingerprint className="h-4 w-4 text-emerald-600" />
                <span className="sr-only">Registrar rostro / biometría</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Registrar rostro / biometría</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider> */}
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-amber-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setDisableOpen(true);
                }}
              >
                {data.is_active ? (
                  <IconUserOff className="h-4 w-4 text-amber-500" />
                ) : (
                  <IconUserCheck className="h-4 w-4 text-emerald-500" />
                )}
                <span className="sr-only">{data.is_active ? "Desactivar cliente" : "Reactivar cliente"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{data.is_active ? "Desactivar cliente" : "Reactivar cliente"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOpen(true);
                }}
              >
                <IconTrash className="h-4 w-4 text-destructive" />
                <span className="sr-only">Eliminar completamente</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Eliminar completamente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};
