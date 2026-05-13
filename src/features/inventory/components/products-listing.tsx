import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductFormSheet } from "@/features/inventory/components/product-form-sheet";
import { InventoryActionDialog } from "@/features/inventory/components/inventory-action-dialog";
import { getProductsListing, type ProductInventoryItem } from "@/features/inventory/actions/inventory-actions";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { ProductDeactivateButton } from "@/features/inventory/components/product-row-actions";

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function ProductThumb({ product }: { product: ProductInventoryItem }) {
  if (!product.image_url) {
    return <div className="size-11 rounded-md border bg-muted" />;
  }

  return (
    <div
      className="size-11 rounded-md border bg-cover bg-center"
      style={{ backgroundImage: `url(${product.image_url})` }}
      aria-label={`Imagen de ${product.name}`}
    />
  );
}

export async function ProductsListing({
  page,
  perPage,
  name,
  isActive,
}: {
  page: number;
  perPage: number;
  name?: string | null;
  isActive?: string | null;
}) {
  const access = await getUserAccessContext();
  const canCreate = hasPermission(access, "products.create");
  const canUpdate = hasPermission(access, "products.update");
  const canDelete = hasPermission(access, "products.delete");
  const canAdjustInventory = hasPermission(access, "inventory.adjust");
  const { data, total } = await getProductsListing({ page, perPage, name, isActive });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Productos</CardTitle>
          <CardDescription>{total} productos registrados</CardDescription>
        </div>
        {canCreate ? <ProductFormSheet /> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-col gap-3 sm:flex-row">
          <Input name="name" defaultValue={name || ""} placeholder="Buscar por nombre, SKU o código de barras" />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Venta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No hay productos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProductThumb product={product} />
                        <span className="font-medium">{product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        <span>{product.barcode || "-"}</span>
                        {product.sku ? <span className="text-muted-foreground">SKU {product.sku}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatQuantity(product.stock_quantity)}</TableCell>
                    <TableCell>{formatMoney(product.cost_price)}</TableCell>
                    <TableCell>{formatMoney(product.sale_price)}</TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {canAdjustInventory ? <InventoryActionDialog product={product} /> : null}
                        {canUpdate ? (
                          <ProductFormSheet product={product} trigger={<Button variant="outline" size="sm">Editar</Button>} />
                        ) : null}
                        {canDelete && product.is_active ? (
                          <ProductDeactivateButton productId={product.id} />
                        ) : null}
                      </div>
                    </TableCell>
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
