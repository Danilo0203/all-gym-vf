import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventoryMovements, type InventoryMovementType } from "@/features/inventory/actions/inventory-actions";

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(value));
}

function formatQuantity(value: number | null | undefined) {
  const quantity = value || 0;
  const formatted = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return quantity > 0 ? `+${formatted}` : formatted;
}

function getMovementLabel(type: InventoryMovementType) {
  switch (type) {
    case "entry":
      return "Entrada";
    case "sale":
      return "Venta";
    case "manual_exit":
      return "Salida manual";
    case "adjustment":
      return "Ajuste físico";
    case "void":
      return "Anulación";
    default:
      return type;
  }
}

function getMovementVariant(type: InventoryMovementType) {
  switch (type) {
    case "entry":
      return "success" as const;
    case "sale":
    case "manual_exit":
      return "warning" as const;
    case "adjustment":
      return "secondary" as const;
    case "void":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export async function InventoryMovementsListing({
  page,
  perPage,
  productName,
  movementType,
}: {
  page: number;
  perPage: number;
  productName?: string | null;
  movementType?: string | null;
}) {
  const { data, total } = await getInventoryMovements({ page, perPage, productName, movementType });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimientos de inventario</CardTitle>
        <CardDescription>{total} movimientos registrados</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-col gap-3 sm:flex-row">
          <Input name="name" defaultValue={productName || ""} placeholder="Buscar por producto" />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No hay movimientos de inventario.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(movement.created_at)}</TableCell>
                    <TableCell className="font-medium">{movement.product_name}</TableCell>
                    <TableCell>
                      <Badge variant={getMovementVariant(movement.movement_type)}>
                        {getMovementLabel(movement.movement_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatQuantity(movement.quantity_delta)}</TableCell>
                    <TableCell>
                      {movement.quantity_before ?? "-"} → {movement.quantity_after ?? "-"}
                    </TableCell>
                    <TableCell>{movement.sale_number || movement.note || "-"}</TableCell>
                    <TableCell>{movement.created_by_name}</TableCell>
                    <TableCell>{formatMoney(movement.unit_price || movement.unit_cost)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
