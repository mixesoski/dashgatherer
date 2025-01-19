import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Area,
  ResponsiveContainer,
} from "recharts";

interface GarminChartProps {
  data: any[];
}

export const GarminChart = ({ data }: GarminChartProps) => {
  // Sort data by date to ensure proper chronological order
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Your TRIMP Data</h2>
      <div className="w-full h-[500px] bg-white rounded-lg shadow p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={sortedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="trimpareacolor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit'
                });
              }}
              stroke="#94a3b8"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px'
              }}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              }}
              formatter={(value: number) => [`${value}`, 'TRIMP']}
            />
            <Area
              type="monotone"
              dataKey="trimp"
              stroke="none"
              fillOpacity={1}
              fill="url(#trimpareacolor)"
            />
            <Line
              type="monotone"
              dataKey="trimp"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 4, fill: "#0ea5e9", stroke: "white", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "#0ea5e9", stroke: "white", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};