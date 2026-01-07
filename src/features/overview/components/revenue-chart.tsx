'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { RevenueByMonth } from '../actions/dashboard-actions';

interface RevenueChartProps {
  data: RevenueByMonth[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const formatCurrency = (value: number) => {
    return `Q${value.toLocaleString('es-GT', { minimumFractionDigits: 0 })}`;
  };

  return (
    <Card className='col-span-4'>
      <CardHeader>
        <CardTitle className='text-lg font-semibold'>Ingresos por Mes</CardTitle>
        <p className='text-sm text-muted-foreground'>Evolución de los últimos 6 meses</p>
      </CardHeader>
      <CardContent className='pl-2'>
        <ResponsiveContainer width='100%' height={350}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id='revenueGradient' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor='hsl(142, 76%, 36%)' stopOpacity={1} />
                <stop offset='100%' stopColor='hsl(142, 76%, 36%)' stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' className='stroke-muted' vertical={false} />
            <XAxis
              dataKey='month'
              stroke='hsl(var(--muted-foreground))'
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke='hsl(var(--muted-foreground))'
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `Q${value}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className='rounded-lg border bg-background p-2 shadow-sm'>
                      <div className='grid grid-cols-2 gap-2'>
                        <div className='flex flex-col'>
                          <span className='text-[0.70rem] uppercase text-muted-foreground'>
                            Ingresos
                          </span>
                          <span className='font-bold text-emerald-600'>
                            {formatCurrency(payload[0].value as number)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey='revenue' 
              fill='url(#revenueGradient)' 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
