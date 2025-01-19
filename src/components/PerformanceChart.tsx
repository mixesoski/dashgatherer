import * as React from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface GarminData {
  date: string
  trimp: number
  activity: string
  atl: number
  ctl: number
  tsb: number
}

interface Props {
  data: GarminData[]
}

const config = {
  atl: {
    label: "Acute Load",
    theme: {
      light: "rgb(59, 130, 246)", // Blue
      dark: "rgb(59, 130, 246)",
    },
  },
  tsb: {
    label: "Stress Balance",
    theme: {
      light: "rgb(239, 68, 68)", // Red
      dark: "rgb(239, 68, 68)",
    },
  },
  ctl: {
    label: "Chronic Load",
    theme: {
      light: "rgb(234, 179, 8)", // Yellow
      dark: "rgb(234, 179, 8)",
    },
  },
}

export function PerformanceChart({ data }: Props) {
  const sortedData = React.useMemo(() => {
    return [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString(),
      }))
  }, [data])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Training Load Balance</CardTitle>
        <CardDescription>
          Track your training load metrics over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[600px]">
          <ChartContainer config={config}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={sortedData}
                margin={{ top: 20, right: 30, left: 0, bottom: 30 }}
              >
                <XAxis
                  dataKey="date"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                  domain={['auto', 'auto']}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  cursor={{ stroke: '#888888', strokeDasharray: '4 4' }}
                />
                <Line
                  type="monotone"
                  dataKey="atl"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 6,
                    style: { fill: "var(--color-atl)" },
                  }}
                  style={{
                    stroke: "var(--color-atl)",
                  }}
                  fill="rgba(59, 130, 246, 0.1)"
                  fillOpacity={0.6}
                />
                <Line
                  type="monotone"
                  dataKey="tsb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 6,
                    style: { fill: "var(--color-tsb)" },
                  }}
                  style={{
                    stroke: "var(--color-tsb)",
                  }}
                  fill="rgba(239, 68, 68, 0.1)"
                  fillOpacity={0.6}
                />
                <Line
                  type="monotone"
                  dataKey="ctl"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 6,
                    style: { fill: "var(--color-ctl)" },
                  }}
                  style={{
                    stroke: "var(--color-ctl)",
                  }}
                  fill="rgba(234, 179, 8, 0.1)"
                  fillOpacity={0.6}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}