'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';
import type { BodyAssessmentEntry } from '../../../actions/customer-history-actions';
import { WeightChart } from './weight-chart';

interface BodyAssessmentTabProps {
  bodyAssessments: BodyAssessmentEntry[];
}

export function BodyAssessmentTab({ bodyAssessments }: BodyAssessmentTabProps) {
  const bodyTypeLabels: Record<string, string> = {
    ectomorph: 'Ectomorfo',
    mesomorph: 'Mesomorfo', 
    endomorph: 'Endomorfo'
  };

  // Calcular cambios respecto a la medición anterior
  const assessmentsWithChange = bodyAssessments.map((assessment, idx) => {
    const prev = bodyAssessments[idx + 1]; // anterior en orden cronológico inverso
    return {
      ...assessment,
      weightChange: prev?.weight_kg && assessment.weight_kg 
        ? assessment.weight_kg - prev.weight_kg 
        : null
    };
  });

  return (
    <div className="space-y-6">
      {/* Gráfico de evolución de peso */}
      <WeightChart data={bodyAssessments} />

      {/* Tabla de mediciones */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Mediciones</CardTitle>
          <CardDescription>Registro de evaluaciones físicas</CardDescription>
        </CardHeader>
        <CardContent>
          {bodyAssessments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay registros de evaluaciones</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Cambio</TableHead>
                    <TableHead>Estatura</TableHead>
                    <TableHead>% Grasa</TableHead>
                    <TableHead>Masa Muscular</TableHead>
                    <TableHead>Pecho</TableHead>
                    <TableHead>Cintura</TableHead>
                    <TableHead>Brazo</TableHead>
                    <TableHead>Somatotipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessmentsWithChange.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell>
                        {format(new Date(assessment.assessment_date), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {assessment.weight_kg ? `${assessment.weight_kg} kg` : '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.weightChange !== null ? (
                          <div className="flex items-center gap-1">
                            {assessment.weightChange > 0 ? (
                              <>
                                <IconTrendingUp className="h-4 w-4 text-red-500" />
                                <span className="text-red-500">+{assessment.weightChange.toFixed(1)}</span>
                              </>
                            ) : assessment.weightChange < 0 ? (
                              <>
                                <IconTrendingDown className="h-4 w-4 text-green-500" />
                                <span className="text-green-500">{assessment.weightChange.toFixed(1)}</span>
                              </>
                            ) : (
                              <>
                                <IconMinus className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-400">0</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {assessment.height_cm ? `${assessment.height_cm} cm` : '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.body_fat_percentage ? `${assessment.body_fat_percentage}%` : '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.muscle_mass ? `${assessment.muscle_mass} kg` : '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.chest_cm ? `${assessment.chest_cm} cm` : '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.waist_cm ? `${assessment.waist_cm} cm` : '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.arm_cm ? `${assessment.arm_cm} cm` : '-'}
                      </TableCell>
                      <TableCell>
                        {assessment.body_type ? (
                          <Badge variant="outline">
                            {bodyTypeLabels[assessment.body_type] || assessment.body_type}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
