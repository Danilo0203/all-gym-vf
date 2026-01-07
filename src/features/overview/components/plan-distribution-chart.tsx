'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cell, Pie, PieChart, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { PlanDistribution } from '../actions/dashboard-actions';

interface PlanDistributionChartProps {
  data: PlanDistribution[];
}

export function PlanDistributionChart({ data }: PlanDistributionChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-lg font-semibold'>Distribución de Planes</CardTitle>
        </CardHeader>
        <CardContent className='flex h-[200px] items-center justify-center'>
          <p className='text-muted-foreground'>No hay datos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-lg font-semibold'>Distribución de Planes</CardTitle>
        <p className='text-sm text-muted-foreground'>Suscripciones activas por tipo</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={220}>
          <PieChart>
            <Pie
              data={data}
              cx='50%'
              cy='50%'
              innerRadius={50}
              outerRadius={80}
              fill='#8884d8'
              paddingAngle={3}
              dataKey='count'
              nameKey='name'
              label={({ name, percentage }) => `${percentage}%`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className='rounded-lg border bg-background p-2 shadow-sm'>
                      <p className='font-medium'>{item.name}</p>
                      <p className='text-sm text-muted-foreground'>
                        {item.count} miembros ({item.percentage}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              verticalAlign='bottom' 
              height={36}
              formatter={(value) => <span className='text-sm'>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
