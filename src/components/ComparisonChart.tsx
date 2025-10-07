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
import type { YearlySnapshot, ScenarioResults } from '../types';

interface ComparisonChartProps {
  results?: YearlySnapshot[];
  scenarioResults?: ScenarioResults;
}

export default function ComparisonChart({ results, scenarioResults }: ComparisonChartProps) {
  if (scenarioResults) {
    const combinedData = scenarioResults.baseline.map((baselinePoint, index) => ({
      year: baselinePoint.year,
      pessimisticBuy: scenarioResults.pessimistic[index].mortgageNetPositionAfterSale,
      pessimisticRent: scenarioResults.pessimistic[index].rentNetPositionAfterTax,
      baselineBuy: baselinePoint.mortgageNetPositionAfterSale,
      baselineRent: baselinePoint.rentNetPositionAfterTax,
      optimisticBuy: scenarioResults.optimistic[index].mortgageNetPositionAfterSale,
      optimisticRent: scenarioResults.optimistic[index].rentNetPositionAfterTax,
    }));

    return (
      <div className="p-6 rounded-lg shadow-xl bg-card">
        <h2 className="text-2xl font-semibold mb-6 text-accent">
          Net Position Over Time - All Scenarios
        </h2>
        <ResponsiveContainer width="100%" height={500}>
          <LineChart
            data={combinedData}
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
            <Legend wrapperStyle={{ color: '#e2e8f0', height:'80px', paddingTop: '40px' }} />
            {/* Pessimistic lines (red/pink shades) */}
            <Line
              type="monotone"
              dataKey="pessimisticBuy"
              stroke="#f87171"
              name="Pessimistic: Buy"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="pessimisticRent"
              stroke="#fb923c"
              name="Pessimistic: Rent"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
            {/* Baseline lines (blue/yellow) */}
            <Line
              type="monotone"
              dataKey="baselineBuy"
              stroke="#60a5fa"
              name="Baseline: Buy"
              strokeWidth={3}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="baselineRent"
              stroke="#fbbf24"
              name="Baseline: Rent"
              strokeWidth={3}
              dot={false}
            />
            {/* Optimistic lines (green shades) */}
            <Line
              type="monotone"
              dataKey="optimisticBuy"
              stroke="#34d399"
              name="Optimistic: Buy"
              strokeWidth={2}
              dot={false}
              strokeDasharray="3 3"
            />
            <Line
              type="monotone"
              dataKey="optimisticRent"
              stroke="#a78bfa"
              name="Optimistic: Rent"
              strokeWidth={2}
              dot={false}
              strokeDasharray="3 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Original single-scenario view
  if (!results) return null;

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
          <Legend wrapperStyle={{ color: '#e2e8f0', height:'60px', paddingTop: '40px' }} />
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
