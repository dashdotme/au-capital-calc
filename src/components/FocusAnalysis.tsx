import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { PropertyInputs, RentInputs, InvestmentInputs, YearlySnapshot } from '../types';
import { getMetricValue, runFocusComparison } from '../utils/calculations';
import { calculateFocusRange, getMetricLabel, getMetricUnit, formatCompactValue } from '../utils/focusRanges';
import FocusSlider from './FocusSlider';

interface FocusAnalysisProps {
  metricKey: string;
  propertyInputs: PropertyInputs;
  rentInputs: RentInputs;
  investmentInputs: InvestmentInputs;
  timeHorizon: number;
}

const advantage = (s: YearlySnapshot) => s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;

export default function FocusAnalysis({
  metricKey,
  propertyInputs,
  rentInputs,
  investmentInputs,
  timeHorizon,
}: FocusAnalysisProps) {
  const baselineValue = getMetricValue(propertyInputs, rentInputs, investmentInputs, metricKey);
  const defaultRange = calculateFocusRange(metricKey, baselineValue);

  const [sliderValues, setSliderValues] = useState<number[]>([
    defaultRange.extremeLow,
    defaultRange.moderateLow,
    defaultRange.baseline,
    defaultRange.moderateHigh,
    defaultRange.extremeHigh,
  ]);

  // One simulation per slider value; each line is the rent-minus-buy advantage
  const scenarios = useMemo(() => {
    return runFocusComparison(
      propertyInputs,
      rentInputs,
      investmentInputs,
      timeHorizon,
      metricKey,
      sliderValues
    );
  }, [propertyInputs, rentInputs, investmentInputs, timeHorizon, metricKey, sliderValues]);

  const chartData = scenarios[0].map((point, index) => {
    const dataPoint: Record<string, number> = { year: point.year };
    scenarios.forEach((scenario, scenarioIndex) => {
      dataPoint[`scenario${scenarioIndex}`] = advantage(scenario[index]);
    });
    return dataPoint;
  });

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  const unit = getMetricUnit(metricKey);

  // Calculate summary values
  const year5Index = Math.min(5, scenarios[0].length - 1);
  const finalIndex = scenarios[0].length - 1;

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
  const formatAdvantage = (value: number) =>
    `${value >= 0 ? 'Rent' : 'Buy'} +${formatCurrency(Math.abs(value))}`;

  return (
    <div className="mt-4 p-4 bg-card/50 rounded-lg border border-border animate-slideDown">
      <h3 className="text-lg font-semibold mb-4 text-accent">
        Focus Mode: {getMetricLabel(metricKey)}
      </h3>

      <p className="text-xs text-text-secondary mb-4">
        Lines show how far renting is ahead of buying (above zero) or behind (below zero), after exit costs and taxes.
      </p>

      <FocusSlider
        values={sliderValues}
        onChange={setSliderValues}
        unit={unit}
        min={Math.min(...sliderValues) * 0.5}
        max={Math.max(...sliderValues) * 1.5}
      />

      {/* Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 15 }}>
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
              tickFormatter={(value) => `$${(value / 1000000).toFixed(2)}m`}
            />
            <Tooltip
              contentStyle={{
                background: '#1a2942',
                border: '1px solid #1e3a5f',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
              formatter={(value: number) => formatAdvantage(value)}
            />
            <Legend wrapperStyle={{ color: '#e2e8f0', height: '80px', paddingTop: '40px' }} />

            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="5 5" />

            {/* 5 Scenario Lines */}
            {scenarios.map((_, index) => (
              <Line
                key={index}
                type="monotone"
                dataKey={`scenario${index}`}
                stroke={colors[index]}
                name={formatCompactValue(sliderValues[index], unit)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-4 text-text-secondary">Scenario</th>
              <th className="text-right py-2 px-4 text-text-secondary">After 5 Years</th>
              <th className="text-right py-2 px-4 text-text-secondary">After {timeHorizon} Years</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario, index) => {
              const value5 = advantage(scenario[year5Index]);
              const valueFinal = advantage(scenario[finalIndex]);
              return (
                <tr key={index} className="border-b border-border/50">
                  <td className="py-2 px-4">
                    <span style={{ color: colors[index] }} className="font-semibold">
                      {formatCompactValue(sliderValues[index], unit)}
                    </span>
                  </td>
                  <td className="text-right py-2 px-4 text-text-primary">
                    {formatAdvantage(value5)}
                  </td>
                  <td className="text-right py-2 px-4 text-text-primary font-semibold">
                    {formatAdvantage(valueFinal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
