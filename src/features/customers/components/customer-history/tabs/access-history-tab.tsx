"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IconCalendarStats, IconHistory, IconCheck, IconX } from "@tabler/icons-react";
import type { AccessLogEntry } from "../../../actions/customer-history-actions";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
      label: format(date, "MMM", { locale: es }),
      fullLabel: format(date, "MMMM yyyy", { locale: es }),
      year: date.getFullYear(),
      month: date.getMonth(),
    });
  }

  // Calcular visitas por mes
  const visitsByMonth = months.map((m) => {
    let count = 0;
    Object.keys(heatmapData).forEach((date) => {
      const d = new Date(date);
      if (d.getMonth() === m.month && d.getFullYear() === m.year) {
        count += heatmapData[date];
      }
    });
    return count;
  });

  const maxVisits = Math.max(...visitsByMonth, 1);
  const totalVisits = visitsByMonth.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Heatmap simplificado por mes */}
      <Card className="border-primary/10 shadow-sm overflow-hidden backdrop-blur-sm bg-card/80">
        <CardHeader className="bg-muted/30 border-b border-primary/5 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <IconCalendarStats className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Actividad Anual</CardTitle>
                <CardDescription>Frecuencia de visitas al gimnasio</CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black">{totalVisits}</span>
              <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">
                Visitas Totales
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-10 pb-6 px-6 sm:px-10">
          <div className="flex gap-2 sm:gap-4 items-end justify-between h-40">
            <TooltipProvider>
              {months.map((month, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-3 flex-1 group cursor-default">
                      <div className="relative w-full flex items-end justify-center h-full">
                        <div
                          className={cn(
                            "w-full max-w-[40px] rounded-t-lg transition-all duration-500 ease-out group-hover:opacity-80",
                            visitsByMonth[idx] > 0 ? "bg-primary" : "bg-muted",
                          )}
                          style={{
                            height: `${Math.max((visitsByMonth[idx] / maxVisits) * 100, 5)}%`,
                            opacity: 0.1 + (visitsByMonth[idx] / maxVisits) * 0.9,
                          }}
                        />
                        {visitsByMonth[idx] > 0 && (
                          <span className="absolute -top-6 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {visitsByMonth[idx]}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground transition-colors group-hover:text-primary">
                        {month.label}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-medium">
                      {month.fullLabel}: <span className="font-bold">{visitsByMonth[idx]} visitas</span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de accesos */}
      <Card className="border-primary/10 shadow-sm overflow-hidden backdrop-blur-sm bg-card/80">
        <CardHeader className="bg-muted/30 border-b border-primary/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconHistory className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Historial de Ingresos</CardTitle>
              <CardDescription>Registro cronológico de entradas al recinto</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {accessHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No hay registros de acceso</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-y border-primary/5">
                  <TableHead className="w-[200px] font-bold text-xs uppercase tracking-wider pl-6">
                    Fecha y Hora
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Día</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-right pr-6">
                    Estado de Acceso
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessHistory.map((log) => (
                  <TableRow key={log.id} className="hover:bg-primary/[0.02] border-primary/5 transition-colors h-14">
                    <TableCell className="font-medium pl-6">
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(new Date(log.check_in_time), "dd/MM/yyyy", { locale: es })}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold">
                          {format(new Date(log.check_in_time), "HH:mm 'hs'", { locale: es })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold capitalize">{log.day_of_week}</span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border-transparent flex items-center gap-1 ml-auto w-fit",
                          log.status === "authorized" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600",
                        )}
                      >
                        {log.status === "authorized" ? (
                          <>
                            <IconCheck className="h-3 w-3 stroke-[3]" />
                            AUTORIZADO
                          </>
                        ) : (
                          <>
                            <IconX className="h-3 w-3 stroke-[3]" />
                            DENEGADO
                          </>
                        )}
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
