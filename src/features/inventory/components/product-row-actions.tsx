"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deactivateProduct } from "@/features/inventory/actions/inventory-actions";

export function ProductDeactivateButton({
  productId,
}: {
  productId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await deactivateProduct(productId);
          if (!result.success) {
            toast.error(result.error || "No se pudo desactivar el producto");
            return;
          }

          toast.success("Producto desactivado");
        });
      }}
    >
      Desactivar
    </Button>
  );
}
