import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import type { MonteCarloResults } from '../types';

interface MonteCarloViewProps {
  results: MonteCarloResults;
  timeHorizon: number;
}

export default function MonteCarloView({ results, timeHorizon }: MonteCarloViewProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  // Prepare histogram data for display
  const histogramData = results.histogram.map((bin) => ({
    range: `${(bin.binStart / 1000).toFixed(0)}k`,
    count: bin.count,
    probability: bin.probability * 100,
  }));

  return (
    <div className="mb-6">
      <div className="p-6 rounded-lg shadow-xl bg-card mb-6">
        <h2 className="text-2xl font-semibold mb-6 text-accent">
          Monte Carlo Analysis ({results.iterations.toLocaleString()} Simulations)
        </h2>

        {/* Key Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-xs text-text-secondary mb-1">Rent Better</p>
            <p className="text-2xl font-bold text-accent">
              {formatPercent(results.rentBetterProbability)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-xs text-text-secondary mb-1">Buy Better</p>
            <p className="text-2xl font-bold text-accent">
              {formatPercent(results.buyBetterProbability)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-xs text-text-secondary mb-1">Expected Advantage</p>
            <p className="text-2xl font-bold text-accent">
              {results.expectedAdvantage > 0 ? 'Rent ' : 'Buy '}
              {formatCurrency(Math.abs(results.expectedAdvantage))}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-xs text-text-secondary mb-1">Median Outcome</p>
            <p className="text-2xl font-bold text-accent">
              {results.percentiles.p50 > 0 ? 'Rent ' : 'Buy '}
              {formatCurrency(Math.abs(results.percentiles.p50))}
            </p>
          </div>
        </div>

        {/* Percentiles Table */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 text-text-primary">
            Outcome Distribution (After {timeHorizon} Years)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 text-text-secondary">Percentile</th>
                  <th className="text-right py-2 px-4 text-text-secondary">Advantage</th>
                  <th className="text-left py-2 px-4 text-text-secondary">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-4 text-text-primary">10th (Pessimistic)</td>
                  <td className="text-right py-2 px-4 font-semibold text-text-primary">
                    {formatCurrency(results.percentiles.p10)}
                  </td>
                  <td className="py-2 px-4 text-text-secondary text-xs">
                    {results.percentiles.p10 > 0
                      ? '90% chance rent is at least this much better'
                      : '90% chance buy is at least this much better'}
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-4 text-text-primary">25th</td>
                  <td className="text-right py-2 px-4 font-semibold text-text-primary">
                    {formatCurrency(results.percentiles.p25)}
                  </td>
                  <td className="py-2 px-4 text-text-secondary text-xs">
                    75% of scenarios
                  </td>
                </tr>
                <tr className="border-b border-border/50 bg-card/50">
                  <td className="py-2 px-4 text-text-primary font-bold">50th (Median)</td>
                  <td className="text-right py-2 px-4 font-bold text-accent">
                    {formatCurrency(results.percentiles.p50)}
                  </td>
                  <td className="py-2 px-4 text-text-secondary text-xs">
                    Middle outcome
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-4 text-text-primary">75th</td>
                  <td className="text-right py-2 px-4 font-semibold text-text-primary">
                    {formatCurrency(results.percentiles.p75)}
                  </td>
                  <td className="py-2 px-4 text-text-secondary text-xs">
                    25% of scenarios
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-4 text-text-primary">90th (Optimistic)</td>
                  <td className="text-right py-2 px-4 font-semibold text-text-primary">
                    {formatCurrency(results.percentiles.p90)}
                  </td>
                  <td className="py-2 px-4 text-text-secondary text-xs">
                    {results.percentiles.p90 > 0
                      ? '10% chance rent is even better than this'
                      : '10% chance buy is even better than this'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Histogram */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 text-text-primary">
            Probability Distribution of Outcomes
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={histogramData} margin={{ top: 5, right: 30, left: 20, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis
                dataKey="range"
                stroke="#94a3b8"
                label={{
                  value: 'Advantage (Rent - Buy, in $k)',
                  position: 'insideBottom',
                  offset: -5,
                  fill: '#94a3b8',
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                stroke="#94a3b8"
                label={{
                  value: 'Probability (%)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#94a3b8',
                }}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a2942',
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                }}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <Bar dataKey="probability" fill="#60a5fa" name="Probability" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Time Series with Confidence Bands */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-text-primary">
            Confidence Bands Over Time
          </h3>
          <p className="text-xs text-text-secondary mb-4">
            Shaded areas show 10th-90th percentile range. Solid lines show median outcomes.
          </p>
          <ResponsiveContainer width="100%" height={500}>
            <ComposedChart
              data={results.timeSeriesPercentiles}
              margin={{ top: 5, right: 30, left: 20, bottom: 15 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis
                dataKey="year"
                stroke="#94a3b8"
                label={{
                  value: 'Years',
                  position: 'insideBottom',
                  offset: -5,
                  fill: '#94a3b8',
                }}
              />
              <YAxis
                stroke="#94a3b8"
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
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend wrapperStyle={{ color: '#e2e8f0', height: '80px', paddingTop: '40px' }} />

              {/* Rent confidence band */}
              <Area
                type="monotone"
                dataKey="rentP90"
                stroke="none"
                fill="#fbbf24"
                fillOpacity={0.1}
                name="Rent 90th"
              />
              <Area
                type="monotone"
                dataKey="rentP10"
                stroke="none"
                fill="#fbbf24"
                fillOpacity={0.2}
                name="Rent 10th"
              />

              {/* Buy confidence band */}
              <Area
                type="monotone"
                dataKey="buyP90"
                stroke="none"
                fill="#60a5fa"
                fillOpacity={0.1}
                name="Buy 90th"
              />
              <Area
                type="monotone"
                dataKey="buyP10"
                stroke="none"
                fill="#60a5fa"
                fillOpacity={0.2}
                name="Buy 10th"
              />

              {/* Median lines */}
              <Line
                type="monotone"
                dataKey="rentP50"
                stroke="#fbbf24"
                strokeWidth={3}
                dot={false}
                name="Rent (Median)"
              />
              <Line
                type="monotone"
                dataKey="buyP50"
                stroke="#60a5fa"
                strokeWidth={3}
                dot={false}
                name="Buy (Median)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
