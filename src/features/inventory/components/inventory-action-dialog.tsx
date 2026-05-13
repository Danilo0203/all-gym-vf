"use client";

import { useState, useTransition } from "react";
import { IconLoader2, IconPlus, IconRefresh, IconTransferOut } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  adjustProductStock,
  recordInventoryMovement,
  type ProductInventoryItem,
} from "@/features/inventory/actions/inventory-actions";

interface InventoryActionDialogProps {
  product: ProductInventoryItem;
}

type Mode = "entry" | "manual_exit" | "adjustment";

export function InventoryActionDialog({ product }: InventoryActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("entry");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState(product.cost_price.toFixed(2));
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const parsedUnitCost = Number(unitCost);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      toast.error("Ingresa una cantidad válida.");
      return;
    }

    startTransition(async () => {
      const result =
        mode === "adjustment"
          ? await adjustProductStock({ productId: product.id, countedQuantity: parsedQuantity, note })
          : await recordInventoryMovement({
              productId: product.id,
              movementType: mode,
              quantity: parsedQuantity,
              unitCost: Number.isFinite(parsedUnitCost) ? parsedUnitCost : null,
              note,
            });

      if (!result.success) {
        toast.error(result.error || "No se pudo registrar el movimiento");
        return;
      }

      toast.success("Inventario actualizado");
      setOpen(false);
      setQuantity("");
      setNote("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconRefresh data-icon="inline-start" />
          Inventario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar inventario</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Movimiento</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as Mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="entry">
                    <span className="inline-flex items-center gap-2">
                      <IconPlus data-icon="inline-start" />
                      Entrada
                    </span>
                  </SelectItem>
                  <SelectItem value="manual_exit">
                    <span className="inline-flex items-center gap-2">
                      <IconTransferOut data-icon="inline-start" />
                      Salida manual
                    </span>
                  </SelectItem>
                  <SelectItem value="adjustment">Ajuste a conteo físico</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`quantity-${product.id}`}>
                {mode === "adjustment" ? "Conteo físico" : "Cantidad"}
              </Label>
              <Input
                id={`quantity-${product.id}`}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                type="number"
                min="0"
                step="0.001"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`cost-${product.id}`}>Costo unitario</Label>
              <Input
                id={`cost-${product.id}`}
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                disabled={mode === "adjustment"}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`note-${product.id}`}>Nota</Label>
            <Textarea id={`note-${product.id}`} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <IconLoader2 data-icon="inline-start" className="animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
