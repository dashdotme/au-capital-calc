import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { YearlySnapshot } from '../types';

interface ComparisonChartProps {
  results: YearlySnapshot[];
}

export default function ComparisonChart({ results }: ComparisonChartProps) {
  return (
    <div className="p-6 rounded-lg shadow-xl bg-card">
      <h2 className="text-2xl font-semibold mb-6 text-accent">
        Net Position Over Time
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={results}
          margin={{ top: 5, right: 30, left: 20, bottom: 15 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
          <XAxis
            dataKey="year"
            stroke="#94a3b8"
            height={40}
            label={{
              value: 'Years',
              position: 'insideBottom',
              offset: -5,
              fill: '#94a3b8',
            }}
          />
          <YAxis
            stroke="#94a3b8"
            width={100}
            label={{
              value: 'Net Position ($)',
              angle: -90,
              position: 'insideLeft',
              fill: '#94a3b8',
            }}
            tickFormatter={(value) => `$${(value / 1000000).toFixed(2)}m`}
          />
          <Tooltip
            contentStyle={{
              background: '#1a2942',
              border: '1px solid #1e3a5f',
              borderRadius: '8px',
              color: '#e2e8f0',
            }}
            formatter={(value: number) =>
              `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
            }
          />
          <Legend wrapperStyle={{ color: '#e2e8f0', height:'40px', paddingTop: '30px' }} />
          <Line
            type="monotone"
            dataKey="mortgageNetPositionAfterSale"
            stroke="#60a5fa"
            name="Buy (After Sale)"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="rentNetPositionAfterTax"
            stroke="#fbbf24"
            name="Rent + Invest (After CGT)"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
