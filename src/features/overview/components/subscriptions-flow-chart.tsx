'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { SubscriptionsFlow } from '../actions/dashboard-actions';

interface SubscriptionsFlowChartProps {
  data: SubscriptionsFlow[];
}

export function SubscriptionsFlowChart({ data }: SubscriptionsFlowChartProps) {
  return (
    <Card className='col-span-4 md:col-span-3 h-full'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-lg font-semibold'>Altas vs Bajas</CardTitle>
        <p className='text-sm text-muted-foreground'>Flujo de suscripciones por mes</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={220}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className='rounded-lg border bg-background p-2 shadow-sm'>
                      <p className='font-medium mb-1'>{label}</p>
                      <div className='space-y-1'>
                        <p className='text-sm text-emerald-600'>
                          Nuevas: {payload[0]?.value}
                        </p>
                        <p className='text-sm text-red-500'>
                          Bajas: {payload[1]?.value}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              verticalAlign='bottom' 
              height={36}
              formatter={(value) => (
                <span className='text-sm'>
                  {value === 'newSubs' ? 'Nuevas' : 'Bajas'}
                </span>
              )}
            />
            <Line
              type='monotone'
              dataKey='newSubs'
              name='newSubs'
              stroke='hsl(142, 76%, 36%)'
              strokeWidth={2}
              dot={{ fill: 'hsl(142, 76%, 36%)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type='monotone'
              dataKey='cancelled'
              name='cancelled'
              stroke='hsl(0, 84%, 60%)'
              strokeWidth={2}
              dot={{ fill: 'hsl(0, 84%, 60%)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
