import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PropertyInputs, RentInputs, InvestmentInputs } from '../types';
import { runFocusComparison, type FocusResults } from '../utils/calculations';
import { calculateFocusRange, getMetricLabel, getMetricUnit } from '../utils/focusRanges';
import FocusSlider from './FocusSlider';
import { isScenarioValue } from '../utils/calculations';

interface FocusAnalysisProps {
  metricKey: string;
  propertyInputs: PropertyInputs;
  rentInputs: RentInputs;
  investmentInputs: InvestmentInputs;
  timeHorizon: number;
}

export default function FocusAnalysis({
  metricKey,
  propertyInputs,
  rentInputs,
  investmentInputs,
  timeHorizon,
}: FocusAnalysisProps) {
  // Get baseline value for the metric
  const getBaselineValue = (): number => {
    switch (metricKey) {
      case 'interestRate':
        return isScenarioValue(propertyInputs.interestRate)
          ? propertyInputs.interestRate.baseline
          : propertyInputs.interestRate;
      case 'maintenanceRate':
        return propertyInputs.maintenanceRate;
      case 'monthlyRent':
        return rentInputs.monthlyRent;
      case 'rentIncreaseRate':
        return isScenarioValue(rentInputs.rentIncreaseRate)
          ? rentInputs.rentIncreaseRate.baseline
          : rentInputs.rentIncreaseRate;
      case 'stockMarketReturn':
        return isScenarioValue(investmentInputs.stockMarketReturn)
          ? investmentInputs.stockMarketReturn.baseline
          : investmentInputs.stockMarketReturn;
      case 'propertyGrowthRate':
        return isScenarioValue(investmentInputs.propertyGrowthRate)
          ? investmentInputs.propertyGrowthRate.baseline
          : investmentInputs.propertyGrowthRate;
      case 'dividendYield':
        return investmentInputs.dividendYield ?? 0;
      default:
        return 0;
    }
  };

  const baselineValue = getBaselineValue();
  const defaultRange = calculateFocusRange(metricKey, baselineValue);

  const [sliderValues, setSliderValues] = useState<number[]>([
    defaultRange.extremeLow,
    defaultRange.moderateLow,
    defaultRange.baseline,
    defaultRange.moderateHigh,
    defaultRange.extremeHigh,
  ]);

  // Calculate results
  const results: FocusResults = useMemo(() => {
    return runFocusComparison(
      propertyInputs,
      rentInputs,
      investmentInputs,
      timeHorizon,
      metricKey,
      sliderValues
    );
  }, [propertyInputs, rentInputs, investmentInputs, timeHorizon, metricKey, sliderValues]);

  // Determine which strategy the metric affects
  const isRentMetric = metricKey === 'monthlyRent' || metricKey === 'rentIncreaseRate' ||
                       metricKey === 'stockMarketReturn' || metricKey === 'dividendYield';
  const baselineKey = isRentMetric ? 'mortgageNetPositionAfterSale' : 'rentNetPositionAfterTax';
  const scenarioKey = isRentMetric ? 'rentNetPositionAfterTax' : 'mortgageNetPositionAfterSale';
  const baselineName = isRentMetric ? 'Buy (Baseline)' : 'Rent (Baseline)';

  // Prepare chart data
  const chartData = results.baseline.map((baselinePoint, index) => {
    const dataPoint: Record<string, number> = {
      year: baselinePoint.year,
      baseline: baselinePoint[baselineKey],
    };

    results.scenarios.forEach((scenario, scenarioIndex) => {
      dataPoint[`scenario${scenarioIndex}`] = scenario[index][scenarioKey];
    });

    return dataPoint;
  });

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  const unit = getMetricUnit(metricKey);

  // Calculate summary values
  const year5Index = Math.min(5, results.baseline.length - 1);
  const year30Index = results.baseline.length - 1;

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

  return (
    <div className="mt-4 p-4 bg-card/50 rounded-lg border border-border animate-slideDown">
      <h3 className="text-lg font-semibold mb-4 text-accent">
        Focus Mode: {getMetricLabel(metricKey)}
      </h3>

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
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend wrapperStyle={{ color: '#e2e8f0' }} />

            {/* Baseline */}
            <Line
              type="monotone"
              dataKey="baseline"
              stroke="#64748b"
              name={baselineName}
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />

            {/* 5 Scenario Lines */}
            {results.scenarios.map((_, index) => (
              <Line
                key={index}
                type="monotone"
                dataKey={`scenario${index}`}
                stroke={colors[index]}
                name={`${unit === '$' ? `$${Math.round(sliderValues[index])}` : `${sliderValues[index]}${unit}`}`}
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
            {results.scenarios.map((scenario, index) => {
              const value5 = scenario[year5Index][scenarioKey];
              const value30 = scenario[year30Index][scenarioKey];
              return (
                <tr key={index} className="border-b border-border/50">
                  <td className="py-2 px-4">
                    <span style={{ color: colors[index] }} className="font-semibold">
                      {unit === '$' ? `$${Math.round(sliderValues[index])}` : `${sliderValues[index]}${unit}`}
                    </span>
                  </td>
                  <td className="text-right py-2 px-4 text-text-primary">
                    {formatCurrency(value5)}
                  </td>
                  <td className="text-right py-2 px-4 text-text-primary font-semibold">
                    {formatCurrency(value30)}
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
