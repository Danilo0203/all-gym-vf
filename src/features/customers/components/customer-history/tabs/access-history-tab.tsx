'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AccessLogEntry } from '../../../actions/customer-history-actions';

interface AccessHistoryTabProps {
  accessHistory: AccessLogEntry[];
  heatmapData: Record<string, number>;
}

export function AccessHistoryTab({ accessHistory, heatmapData }: AccessHistoryTabProps) {
  // Generar los últimos 12 meses para el heatmap
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: format(date, 'MMM', { locale: es }),
      year: date.getFullYear(),
      month: date.getMonth()
    });
  }

  // Calcular visitas por mes
  const visitsByMonth = months.map(m => {
    let count = 0;
    Object.keys(heatmapData).forEach(date => {
      const d = new Date(date);
      if (d.getMonth() === m.month && d.getFullYear() === m.year) {
        count += heatmapData[date];
      }
    });
    return count;
  });

  const maxVisits = Math.max(...visitsByMonth, 1);

  return (
    <div className="space-y-6">
      {/* Heatmap simplificado por mes */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad de los Últimos 12 Meses</CardTitle>
          <CardDescription>Frecuencia de visitas al gimnasio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end justify-between">
            {months.map((month, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div 
                  className="w-10 rounded transition-all"
                  style={{
                    height: `${Math.max((visitsByMonth[idx] / maxVisits) * 100, 10)}px`,
                    backgroundColor: visitsByMonth[idx] > 0 
                      ? `hsl(142, ${Math.min(visitsByMonth[idx] * 10, 100)}%, ${60 - visitsByMonth[idx] * 2}%)`
                      : 'hsl(var(--muted))'
                  }}
                  title={`${visitsByMonth[idx]} visitas`}
                />
                <span className="text-xs text-muted-foreground">{month.label}</span>
                <span className="text-xs font-medium">{visitsByMonth[idx]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de accesos */}
      <Card>
        <CardHeader>
          <CardTitle>Registro de Ingresos</CardTitle>
          <CardDescription>Últimos {accessHistory.length} registros</CardDescription>
        </CardHeader>
        <CardContent>
          {accessHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay registros de acceso</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Día</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessHistory.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.check_in_time), "dd/MM/yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>{log.day_of_week}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'authorized' ? 'default' : 'destructive'}>
                        {log.status === 'authorized' ? 'Autorizado' : 'Denegado'}
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
