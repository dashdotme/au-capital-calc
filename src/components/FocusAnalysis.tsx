import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InvestmentInputs, PropertyInputs, RentInputs, YearlySnapshot } from '../types';
import { getMetricValue, runFocusComparison } from '../utils/calculations';
import { calculateFocusRange, formatCompactValue, getMetricLabel, getMetricUnit } from '../utils/focusRanges';
import { formatAdvantage, formatCompactCurrency } from '../utils/format';
import FocusSlider from './FocusSlider';
import { FOCUS_RAMP, INK, axisProps, gridProps, tooltipProps, yearTicks } from './chartTheme';

interface FocusAnalysisProps {
  metricKey: string;
  propertyInputs: PropertyInputs;
  rentInputs: RentInputs;
  investmentInputs: InvestmentInputs;
  timeHorizon: number;
  onClose: () => void;
}

const advantage = (s: YearlySnapshot) => s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;

export default function FocusAnalysis({
  metricKey,
  propertyInputs,
  rentInputs,
  investmentInputs,
  timeHorizon,
  onClose,
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

  const scenarios = useMemo(
    () => runFocusComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon, metricKey, sliderValues),
    [propertyInputs, rentInputs, investmentInputs, timeHorizon, metricKey, sliderValues]
  );

  const chartData = scenarios[0].map((point, index) => {
    const dataPoint: Record<string, number> = { year: point.year };
    scenarios.forEach((scenario, i) => {
      dataPoint[`s${i}`] = advantage(scenario[index]);
    });
    return dataPoint;
  });

  const unit = getMetricUnit(metricKey);
  const label = getMetricLabel(metricKey);
  const year5Index = Math.min(5, scenarios[0].length - 1);
  const finalIndex = scenarios[0].length - 1;
  const sliderMin = Math.min(0, Math.min(...sliderValues) * 0.5);
  const sliderMax = Math.max(...sliderValues) * 1.5 || 1;

  return (
    <section aria-label={`Explore ${label}`} className="card flex flex-col gap-4 border-line-strong px-5 py-6 sm:px-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Explore</span>
          <h2 className="m-0 text-lg font-semibold">How {label.toLowerCase()} changes the result</h2>
          <p className="m-0 text-[13px] text-ink-2">
            Drag the handles. Lines above zero mean renting is ahead; below zero, buying.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close explore panel"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-ink-2 hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <FocusSlider values={sliderValues} onChange={setSliderValues} unit={unit} min={sliderMin} max={sliderMax} label={label} />

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" {...axisProps} ticks={yearTicks(timeHorizon)} interval={0} tickFormatter={(y: number) => (y === 0 ? 'Year 0' : String(y))} />
            <YAxis {...axisProps} width={64} tickFormatter={(v: number) => formatCompactCurrency(v)} />
            <ReferenceLine y={0} stroke={INK.muted} />
            <Tooltip
              {...tooltipProps}
              labelFormatter={(y) => `Sell in year ${y}`}
              formatter={(value: number, name: string) => [formatAdvantage(value), name]}
            />
            {scenarios.map((_, i) => (
              <Line
                key={i}
                dataKey={`s${i}`}
                name={formatCompactValue(sliderValues[i], unit)}
                stroke={FOCUS_RAMP[i]}
                strokeWidth={i === 2 ? 2.5 : 2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-right text-xs text-ink-2">
              <th scope="col" className="pb-2 text-left font-medium">{label}</th>
              <th scope="col" className="pb-2 font-medium">Sell after {year5Index} years</th>
              <th scope="col" className="pb-2 font-medium">After {timeHorizon} years</th>
            </tr>
          </thead>
          <tbody className="text-right font-mono">
            {scenarios.map((scenario, i) => (
              <tr key={i} className="border-t border-line">
                <th scope="row" className="py-2 text-left font-normal">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: FOCUS_RAMP[i] }} />
                    {formatCompactValue(sliderValues[i], unit)}
                  </span>
                </th>
                <td className="py-2 text-ink-2">{formatAdvantage(advantage(scenario[year5Index]))}</td>
                <td className="py-2">{formatAdvantage(advantage(scenario[finalIndex]))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
