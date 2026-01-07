'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PaymentEntry } from '../../../actions/customer-history-actions';

interface PaymentHistoryTabProps {
  paymentHistory: PaymentEntry[];
}

export function PaymentHistoryTab({ paymentHistory }: PaymentHistoryTabProps) {
  const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount_paid, 0);
  const totalDiscount = paymentHistory.reduce((sum, p) => sum + p.discount_applied, 0);

  // Fix: Parse YYYY-MM-DD manually
  const parseDate = (dateStr: string | Date | undefined | null) => {
    if (!dateStr) return null;
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
       const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
       return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  };

  const paymentMethodLabels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia'
  };

  const statusLabels: Record<string, string> = {
    active: 'Activa',
    expired: 'Vencida',
    cancelled: 'Cancelada'
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{paymentHistory.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">Q{totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Descuentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">Q{totalDiscount.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de pagos */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
          <CardDescription>Todos los pagos realizados</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay registros de pagos</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentHistory.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {format(new Date(payment.payment_date), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium">{payment.plan_name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      Q{payment.amount_original.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.discount_applied > 0 ? (
                        <span className="text-orange-500">-Q{payment.discount_applied.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      Q{payment.amount_paid.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.subscription_start && payment.subscription_end ? (
                        <>
                          {(() => {
                            const start = parseDate(payment.subscription_start);
                            const end = parseDate(payment.subscription_end);
                            return (
                                <>
                                  {start && format(start, "dd/MM/yy")} - {end && format(end, "dd/MM/yy")}
                                </>
                            )
                          })()}
                        </>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          payment.subscription_status === 'active' ? 'default' : 
                          payment.subscription_status === 'expired' ? 'secondary' : 'destructive'
                        }
                      >
                        {statusLabels[payment.subscription_status] || payment.subscription_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
