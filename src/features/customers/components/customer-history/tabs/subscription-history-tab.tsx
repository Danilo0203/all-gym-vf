'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SubscriptionEntry } from '../../../actions/customer-history-actions';

import { RenewSubscriptionSheet } from '../../renew-subscription-sheet';

interface SubscriptionHistoryTabProps {
  subscriptionHistory: SubscriptionEntry[];
  customerId: string;
  customerName: string;
  lastAssessment?: {
    weight_kg: number;
    height_cm: number;
    body_type: string;
  } | null;
}

export function SubscriptionHistoryTab({ 
  subscriptionHistory,
  customerId,
  customerName,
  lastAssessment 
}: SubscriptionHistoryTabProps) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Activa', variant: 'default' },
    expired: { label: 'Vencida', variant: 'secondary' },
    cancelled: { label: 'Cancelada', variant: 'destructive' }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Historial de Suscripciones</CardTitle>
          <CardDescription>Todas las membresías contratadas</CardDescription>
        </div>
        <RenewSubscriptionSheet 
          customerId={customerId} 
          customerName={customerName} 
          lastAssessment={lastAssessment} 
        />
      </CardHeader>
      <CardContent>
        {subscriptionHistory.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No hay registros de suscripciones</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Descuento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptionHistory.map((sub) => {
                // Fix: Parse YYYY-MM-DD manually to prevent UTC shift
                const parseDate = (dateStr: string | Date) => {
                  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                     const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
                     return new Date(year, month - 1, day);
                  }
                  return new Date(dateStr);
                };

                const startDate = parseDate(sub.start_date);
                const endDate = parseDate(sub.end_date);
                const duration = differenceInDays(endDate, startDate);
                const total = sub.price - sub.discount_amount;
                
                // Calcular estado REAL basado en fecha de vencimiento
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDateNormalized = new Date(endDate);
                endDateNormalized.setHours(0, 0, 0, 0);
                
                let realStatus = sub.status;
                if (sub.status === 'active' && endDateNormalized < today) {
                  realStatus = 'expired';
                }
                
                const config = statusConfig[realStatus] || { label: realStatus, variant: 'outline' as const };

                return (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.plan_name}</TableCell>
                    <TableCell>
                      {format(startDate, "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      {format(endDate, "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {duration} días
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      Q{sub.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {sub.discount_amount > 0 ? (
                        <span className="text-orange-500">-Q{sub.discount_amount.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      Q{total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
