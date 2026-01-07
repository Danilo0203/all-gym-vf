"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BodyAssessmentEntry } from "../../../actions/customer-history-actions"

export const description = "Gráfico interactivo de peso"

const chartConfig = {
  weight: {
    label: "Peso (kg)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

interface WeightChartProps {
  data: BodyAssessmentEntry[]
}

export function WeightChart({ data }: WeightChartProps) {
  const [timeRange, setTimeRange] = React.useState("90d")

  // Transform data
  const chartData = React.useMemo(() => {
     return data
      .filter((item) => item.weight_kg !== null && item.weight_kg !== undefined)
      .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime())
      .map((item) => ({
        date: item.assessment_date, // Keep as string ISO
        weight: item.weight_kg as number,
      }))
  }, [data])

  const filteredData = React.useMemo(() => {
    const referenceDate = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    } else if (timeRange === "all") {
       return chartData
    }
    
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return chartData.filter((item) => new Date(item.date) >= startDate)
  }, [chartData, timeRange])

  // Handle empty state
  if (chartData.length === 0) {
       return (
          <Card className="flex flex-col items-center justify-center p-6 bg-muted/20">
              <p className="text-muted-foreground text-sm">No hay datos suficientes.</p>
          </Card>
      )
  }

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Evolución del Peso</CardTitle>
          <CardDescription>
             Historial de progreso
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Últimos 3 meses" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg">
              Todo
            </SelectItem>
            <SelectItem value="90d" className="rounded-lg">
              Últimos 3 meses
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Últimos 30 días
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Últimos 7 días
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart accessibilityLayer data={filteredData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                 const date = new Date(value)
                 return format(date, "MMM d", { locale: es })
              }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              shared={false}
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  labelFormatter={(value: any) => {
                    if (!value) return ""
                    const date = new Date(value)
                    if (isNaN(date.getTime())) {
                       return value
                    }
                    return format(date, "PPP", { locale: es })
                  }}
                />
              }
            />
            <Bar dataKey="weight" fill="var(--color-weight)" radius={4} maxBarSize={50} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
