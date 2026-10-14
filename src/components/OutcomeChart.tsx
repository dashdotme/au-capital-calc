import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ScenarioResults, YearlySnapshot } from '../types';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { formatAdvantage, formatCompactCurrency, formatCurrency } from '../utils/format';
import { INK, SERIES, axisProps, gridProps, niceTicks, tooltipProps, yearTicks } from './chartTheme';

interface OutcomeChartProps {
  baseline: YearlySnapshot[];
  scenarioResults: ScenarioResults | null;
  crossoverYear: number | null;
  sellYear: number;
  onSellYearChange: (year: number) => void;
}

type View = 'advantage' | 'worth';

const advantage = (s: YearlySnapshot) => s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;

/** Label only the last point of a line, to the right of the plot. */
function endLabel(text: string, fill: string, lastIndex: number, show = true) {
  return function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
    if (!show || props.index !== lastIndex) return null;
    return (
      <text x={Number(props.x) + 8} y={Number(props.y) + 4} fill={fill} fontSize={12}>
        {text}
      </text>
    );
  };
}

function LineSample({ dash, color, width }: { dash?: string; color: string; width: number }) {
  return (
    <svg width="24" height="6" aria-hidden>
      <line x1="0" x2="24" y1="3" y2="3" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

export default function OutcomeChart({
  baseline,
  scenarioResults,
  crossoverYear,
  sellYear,
  onSellYearChange,
}: OutcomeChartProps) {
  const [view, setView] = useState<View>('advantage');
  const wide = useMediaQuery('(min-width: 640px)');
  const margin = { top: 28, right: wide ? 96 : 12, bottom: 4, left: 4 };
  const lastIndex = baseline.length - 1;

  const data = baseline.map((s, i) => ({
    year: s.year,
    base: advantage(s),
    pes: scenarioResults ? advantage(scenarioResults.pessimistic[i]) : undefined,
    opt: scenarioResults ? advantage(scenarioResults.optimistic[i]) : undefined,
    buy: s.mortgageNetPositionAfterSale,
    rent: s.rentNetPositionAfterTax,
  }));

  const values = data.flatMap((d) => [d.base, d.pes, d.opt]).filter((v): v is number => v !== undefined);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const xTicks = yearTicks(lastIndex);

  // Clicking a year on either chart makes it the sell year (the data index is the year)
  const handleClick = (state: { activeTooltipIndex?: number | string | null } | null) => {
    const year = Number(state?.activeTooltipIndex);
    if (Number.isFinite(year) && year >= 1) onSellYearChange(year);
  };
  const sellMarker = sellYear < lastIndex && (
    <ReferenceLine x={sellYear} stroke={INK.secondary} strokeDasharray="2 3"
      label={{ value: `Sell · year ${sellYear}`, position: 'top', fill: INK.primary, fontSize: 12, offset: 8 }} />
  );

  const tabs: { id: View; label: string }[] = [
    { id: 'advantage', label: "Who's ahead" },
    { id: 'worth', label: 'Net worth' },
  ];

  return (
    <section aria-label="Outcome over time" className="card flex flex-col gap-4 px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-lg font-semibold">
            {view === 'advantage' ? 'Who is ahead, by the year you sell' : 'Net worth if you sold that year'}
          </h2>
          <span className="text-xs text-muted">Click a year to see the results for selling then.</span>
        </div>
        <div role="tablist" aria-label="Chart view" className="flex rounded-lg border border-line bg-ground p-[3px]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => setView(tab.id)}
              className={`min-h-9 rounded-md px-3.5 text-[13px] ${
                view === tab.id ? 'bg-line font-semibold text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[340px] sm:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          {view === 'advantage' ? (
            <LineChart data={data} margin={margin} onClick={handleClick} className="cursor-crosshair">
              <ReferenceArea y1={0} y2={yMax} fill={SERIES.rent} fillOpacity={0.08} ifOverflow="extendDomain"
                label={{ value: 'Renting ahead', position: 'insideTopLeft', fill: INK.primary, fontSize: 12, fontWeight: 600 }} />
              <ReferenceArea y1={yMin} y2={0} fill={SERIES.buy} fillOpacity={0.07} ifOverflow="extendDomain"
                label={{ value: 'Buying ahead', position: 'insideBottomLeft', fill: INK.primary, fontSize: 12, fontWeight: 600 }} />
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="year" {...axisProps} ticks={xTicks} interval={0} tickFormatter={(y: number) => (y === 0 && wide ? 'Year 0' : String(y))} />
              <YAxis {...axisProps} width={64} domain={[yMin, yMax]} ticks={ticks} tickFormatter={(v: number) => formatCompactCurrency(v)} />
              <ReferenceLine y={0} stroke={INK.muted} />
              {sellMarker}
              <Tooltip
                {...tooltipProps}
                labelFormatter={(y) => `Sell in year ${y}`}
                formatter={(value: number, name: string) => [formatAdvantage(value), name]}
              />
              {scenarioResults && (
                <Line dataKey="pes" name="Pessimistic" stroke={INK.secondary} strokeWidth={1.5} strokeDasharray="6 4"
                  dot={false} isAnimationActive={false}
                  label={endLabel(formatAdvantage(data[lastIndex].pes!), INK.secondary, lastIndex, wide)} />
              )}
              {scenarioResults && (
                <Line dataKey="opt" name="Optimistic" stroke={INK.secondary} strokeWidth={1.5} strokeDasharray="1 4"
                  strokeLinecap="round" dot={false} isAnimationActive={false}
                  label={endLabel(formatAdvantage(data[lastIndex].opt!), INK.secondary, lastIndex, wide)} />
              )}
              <Line dataKey="base" name="Baseline" stroke={INK.primary} strokeWidth={2.5} dot={false} isAnimationActive={false}
                label={endLabel(formatAdvantage(data[lastIndex].base), INK.primary, lastIndex, wide)} />
              {crossoverYear !== null && (
                <ReferenceDot x={crossoverYear} y={0} r={5} fill={INK.ground} stroke={INK.primary} strokeWidth={2} />
              )}
            </LineChart>
          ) : (
            <LineChart data={data} margin={margin} onClick={handleClick} className="cursor-crosshair">
              <CartesianGrid {...gridProps} />
              {sellMarker}
              <XAxis dataKey="year" {...axisProps} ticks={xTicks} interval={0} tickFormatter={(y: number) => (y === 0 && wide ? 'Year 0' : String(y))} />
              <YAxis {...axisProps} width={64} tickFormatter={(v: number) => formatCompactCurrency(v)} />
              <Tooltip
                {...tooltipProps}
                labelFormatter={(y) => `Sell in year ${y}`}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
              <Line dataKey="buy" name="Buy" stroke={SERIES.buy} strokeWidth={2.5} dot={false} isAnimationActive={false}
                label={endLabel(`Buy ${formatCompactCurrency(data[lastIndex].buy)}`, INK.primary, lastIndex, wide)} />
              <Line dataKey="rent" name="Rent + invest" stroke={SERIES.rent} strokeWidth={2.5} dot={false} isAnimationActive={false}
                label={endLabel(`Rent ${formatCompactCurrency(data[lastIndex].rent)}`, INK.primary, lastIndex, wide)} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2">
        {view === 'advantage' ? (
          <>
            <span className="flex items-center gap-2"><LineSample color={INK.primary} width={2.5} />Baseline</span>
            {crossoverYear !== null && (
              <span className="flex items-center gap-2">
                <svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4" fill={INK.ground} stroke={INK.primary} strokeWidth="2" /></svg>
                Year {crossoverYear}: buying takes the lead
              </span>
            )}
            {scenarioResults && (
              <>
                <span className="flex items-center gap-2"><LineSample color={INK.secondary} width={1.5} dash="6 4" />Pessimistic (high rates, weak markets)</span>
                <span className="flex items-center gap-2"><LineSample color={INK.secondary} width={1.5} dash="1 4" />Optimistic (low rates, strong markets)</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="flex items-center gap-2"><LineSample color={SERIES.buy} width={2.5} />Buy (after selling)</span>
            <span className="flex items-center gap-2"><LineSample color={SERIES.rent} width={2.5} />Rent + invest (after CGT)</span>
          </>
        )}
      </div>
    </section>
  );
}
