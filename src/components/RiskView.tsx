import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonteCarloResults } from '../types';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { formatAdvantage, formatPercent } from '../utils/format';
import { INK, MONO, SERIES, axisProps, gridProps, niceTicks, tooltipProps, yearTicks } from './chartTheme';

interface RiskViewProps {
  results: MonteCarloResults | null;
  running: boolean;
  stale: boolean;
  timeHorizon: number;
  realTerms: boolean;
  onRerun: () => void;
}

/** Pill-shaped label pinned near the top of a vertical reference line. */
function MarkerPill({ viewBox, text, top, filled }: { viewBox?: { x?: number; y?: number }; text: string; top: number; filled: boolean }) {
  if (!viewBox || viewBox.x === undefined) return null;
  const width = text.length * 7.2 + 20;
  const y = (viewBox.y ?? 0) + top;
  return (
    <g>
      <rect x={viewBox.x - width / 2} y={y} width={width} height={24} rx={12}
        fill={filled ? INK.primary : INK.ground} stroke={filled ? 'none' : INK.secondary} />
      <text x={viewBox.x} y={y + 16} textAnchor="middle" fontSize={12} fontFamily={MONO} fill={filled ? INK.ground : INK.primary}>
        {text}
      </text>
    </g>
  );
}

function SpreadStrip({ percentiles }: { percentiles: MonteCarloResults['percentiles'] }) {
  const { p10, p25, p50, p75, p90 } = percentiles;
  const lo = Math.min(p10, 0);
  const hi = Math.max(p90, 0);
  const pad = (hi - lo) * 0.06 || 1;
  const pos = (v: number) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  const marks = [
    { v: p10, name: '10th', row: 'bottom', align: '-translate-x-[10%]' },
    { v: p25, name: '25th', row: 'top', align: '-translate-x-1/2' },
    { v: p50, name: 'Median', row: 'bottom', align: '-translate-x-1/2' },
    { v: p75, name: '75th', row: 'top', align: '-translate-x-1/2' },
    { v: p90, name: '90th', row: 'bottom', align: '-translate-x-[90%]' },
  ];

  return (
    <div
      role="img"
      aria-label={`10th percentile ${formatAdvantage(p10)}, median ${formatAdvantage(p50)}, 90th percentile ${formatAdvantage(p90)}`}
      className="relative h-[136px] font-mono text-xs"
    >
      {marks.filter((m) => m.row === 'top').map((m) => (
        <div key={m.name} className={`absolute top-0 flex flex-col items-center text-ink-2 ${m.align}`} style={{ left: `${pos(m.v)}%` }}>
          <span className="whitespace-nowrap">{formatAdvantage(m.v)}</span>
          <span className="font-sans text-[11px] text-muted">{m.name}</span>
        </div>
      ))}
      <div className="absolute inset-x-0 top-[52px] h-6">
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-muted" style={{ left: `${pos(p10)}%`, width: `${pos(p90) - pos(p10)}%` }} />
        <div className="absolute inset-y-0 rounded-full bg-line-strong" style={{ left: `${pos(p25)}%`, width: `${pos(p75) - pos(p25)}%` }} />
        <div className="absolute -inset-y-2 w-px bg-ink/40" style={{ left: `${pos(0)}%` }} />
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${pos(p50)}%` }} />
      </div>
      {marks.filter((m) => m.row === 'bottom').map((m) => (
        <div key={m.name} className={`absolute top-[90px] flex flex-col ${m.align} ${m.name === 'Median' ? 'items-center text-ink' : 'text-ink'}`}
          style={{ left: `${pos(m.v)}%` }}>
          <span className="whitespace-nowrap">{formatAdvantage(m.v)}</span>
          <span className="font-sans text-[11px] text-muted">{m.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function RiskView({ results, running, stale, timeHorizon, realTerms, onRerun }: RiskViewProps) {
  const wide = useMediaQuery('(min-width: 640px)');
  if (!results) {
    return (
      <div className="card flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="eyebrow">Risk</span>
        <p className="m-0 max-w-md text-lg">
          {running ? 'Simulating 5,000 possible futures…' : 'Simulate 5,000 possible futures to see how likely each option is to win.'}
        </p>
        {!running && (
          <button type="button" onClick={onRerun} className="min-h-11 rounded-lg bg-ink px-5 font-semibold text-ground">
            Run simulation
          </button>
        )}
      </div>
    );
  }

  const buyProbability = results.buyBetterProbability;
  const buyCount = Math.round(buyProbability * results.iterations);
  const typical = results.percentiles.p50;
  const average = results.expectedAdvantage;
  const skewed = Math.sign(typical) !== Math.sign(average);

  const distributionHeadline = skewed
    ? typical < 0
      ? 'Buying usually wins small. Renting occasionally wins big.'
      : 'Renting usually wins small. Buying occasionally wins big.'
    : `${typical < 0 ? 'Buying' : 'Renting'} wins both the typical and the average future.`;

  const bins = results.histogram.map((bin, i) => ({
    ...bin,
    mid: (bin.binStart + bin.binEnd) / 2,
    pct: bin.probability * 100,
    first: i === 0,
    last: i === results.histogram.length - 1,
  }));
  const binWidth = bins.length > 1 ? bins[1].binStart - bins[0].binStart : 1;
  const xMin = bins[0].binStart;
  const xMax = bins[bins.length - 1].binEnd;
  const binFill = (b: (typeof bins)[number]) =>
    b.binStart < 0 && b.binEnd > 0 ? INK.muted : b.mid < 0 ? SERIES.buy : SERIES.rent;

  const timing = results.timeSeriesPercentiles.map((t) => ({ year: t.year, p: t.buyBetterProbability }));
  const peak = timing.reduce((best, t) => (t.p > best.p ? t : best), timing[0]);
  const majorityYear = timing.find((t) => t.year > 0 && t.p >= 0.5)?.year ?? null;
  const timingNote =
    majorityYear === null
      ? 'Renting comes out ahead in most futures whenever you sell.'
      : majorityYear === 1
        ? 'Buying is ahead in most futures from the first year.'
        : `Sell before year ${majorityYear} and renting usually wins.`;

  return (
    <div className={`flex flex-col gap-12 transition-opacity ${running ? 'opacity-50' : ''}`}>
      {stale && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-line-strong px-5 py-3 text-sm">
          <span className="text-ink-2">Your assumptions changed since this simulation ran.</span>
          <button type="button" onClick={onRerun} className="min-h-9 rounded-md bg-ink px-3.5 text-[13px] font-semibold text-ground">
            Re-run
          </button>
        </div>
      )}

      <section aria-label="Summary" className="flex flex-wrap items-end gap-10">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-4">
          <span className="eyebrow">Selling after {timeHorizon} years{realTerms ? " · today's dollars" : ''}</span>
          <div className="flex flex-wrap items-baseline gap-5">
            <span className="font-mono text-7xl leading-[0.9] font-medium tracking-tighter sm:text-[104px]">
              {formatPercent(buyProbability)}
            </span>
            <span className="max-w-[260px] text-[22px] leading-tight font-semibold">chance buying leaves you better off</span>
          </div>
          <div role="img" aria-label={`${formatPercent(buyProbability)} buy ahead, ${formatPercent(1 - buyProbability)} rent ahead`}
            className="flex h-2.5 max-w-[560px] gap-[3px]">
            <div className="rounded-l-full bg-buy" style={{ flex: buyProbability }} />
            <div className="rounded-r-full bg-rent" style={{ flex: 1 - buyProbability }} />
          </div>
          <div className="flex max-w-[560px] justify-between text-[13px] text-ink-2">
            <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-sm bg-buy" />Buy ahead in {buyCount.toLocaleString('en-AU')}</span>
            <span className="flex items-center gap-1.5">Rent ahead in {(results.iterations - buyCount).toLocaleString('en-AU')}<span aria-hidden className="h-2 w-2 rounded-sm bg-rent" /></span>
          </div>
        </div>
        <div className="grid min-w-0 flex-[1_1_400px] grid-cols-2 gap-8 pb-1">
          <div className="flex flex-col gap-1.5 border-t-2 border-ink pt-3.5">
            <span className="text-[13px] text-ink-2">Typical outcome</span>
            <span className="font-mono text-2xl font-medium sm:text-3xl">{formatAdvantage(typical)}</span>
            <span className="text-[13px] leading-snug text-muted">Half of futures land on either side of this.</span>
          </div>
          <div className="flex flex-col gap-1.5 border-t-2 border-dashed border-ink-2 pt-3.5">
            <span className="text-[13px] text-ink-2">Average outcome</span>
            <span className="font-mono text-2xl font-medium sm:text-3xl">{formatAdvantage(average)}</span>
            <span className="text-[13px] leading-snug text-muted">
              {skewed ? 'Pulled the other way by rare, lopsided futures.' : 'Agrees with the typical outcome.'}
            </span>
          </div>
        </div>
      </section>

      <section aria-label="Distribution of outcomes" className="flex flex-col gap-5">
        <div className="flex max-w-3xl flex-col gap-1.5">
          <h2 className="m-0 text-2xl leading-tight font-bold tracking-tight">{distributionHeadline}</h2>
          <p className="m-0 text-[15px] leading-relaxed text-ink-2">
            Where each of the {results.iterations.toLocaleString('en-AU')} futures ends up. Share returns swing more than
            property, so outcomes stretch further toward whichever side owns more shares.
          </p>
        </div>
        <div className="rounded-2xl bg-surface px-3 pt-6 pb-4 sm:px-6">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bins} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} barCategoryGap={4}>
                <ReferenceArea x1={xMin} x2={0} fill={SERIES.buy} fillOpacity={0.05} ifOverflow="hidden"
                  label={{ value: '← Buying ahead', position: 'insideTopLeft', fill: INK.secondary, fontSize: 13, fontWeight: 600 }} />
                <ReferenceArea x1={0} x2={xMax} fill={SERIES.rent} fillOpacity={0.05} ifOverflow="hidden"
                  label={{ value: 'Renting ahead →', position: 'insideTopRight', fill: INK.secondary, fontSize: 13, fontWeight: 600 }} />
                <CartesianGrid {...gridProps} />
                <XAxis
                  type="number"
                  dataKey="mid"
                  domain={[xMin, xMax]}
                  {...axisProps}
                  ticks={niceTicks(xMin, xMax, 6).filter((t) => t >= xMin && t <= xMax)}
                  interval={0}
                  tickFormatter={(v: number) => (Math.abs(v) < binWidth / 4 ? 'Even' : formatAdvantage(v))}
                />
                <YAxis {...axisProps} width={44} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  {...tooltipProps}
                  cursor={{ fill: INK.grid, fillOpacity: 0.4 }}
                  labelFormatter={(_, payload) => {
                    const b = payload?.[0]?.payload as (typeof bins)[number] | undefined;
                    if (!b) return '';
                    if (b.first) return `${formatAdvantage(b.binEnd)} or more toward buying`;
                    if (b.last) return `${formatAdvantage(b.binStart)} or more toward renting`;
                    return `${formatAdvantage(b.binStart)} to ${formatAdvantage(b.binEnd)}`;
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}% of futures`, '']}
                  separator=""
                />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {bins.map((b, i) => (
                    <Cell key={i} fill={binFill(b)} />
                  ))}
                </Bar>
                <ReferenceLine x={0} stroke={INK.primary} strokeOpacity={0.35} />
                <ReferenceLine x={average} stroke={INK.secondary} strokeWidth={2} strokeDasharray="4 4"
                  label={<MarkerPill text={`Average ${formatAdvantage(average)}`} top={0} filled={false} />} />
                <ReferenceLine x={typical} stroke={INK.primary} strokeWidth={2}
                  label={<MarkerPill text={`Typical ${formatAdvantage(typical)}`} top={32} filled />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="m-0 mt-2 px-2 text-xs text-muted">
            Each bar is a {formatAdvantage(binWidth).replace(/^(Rent|Buy) \+/, '')} band; the end bars include everything beyond them.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-label="Chance buying is ahead by sell year" className="flex min-w-0 flex-col gap-3.5 rounded-2xl bg-surface px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Timing</span>
            <h3 className="m-0 text-lg font-semibold">Chance buying is ahead, by the year you sell</h3>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timing} margin={{ top: 24, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="year" {...axisProps} ticks={yearTicks(timeHorizon)} interval={0} tickFormatter={(y: number) => (y === 0 && wide ? 'Year 0' : String(y))} />
                <YAxis {...axisProps} width={44} domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v: number) => formatPercent(v)} />
                <ReferenceLine y={0.5} stroke={INK.muted} strokeDasharray="6 4" />
                <Tooltip {...tooltipProps} labelFormatter={(y) => `Sell in year ${y}`}
                  formatter={(v: number) => [formatPercent(v), 'Buying ahead']} />
                <Area dataKey="p" stroke={SERIES.buy} strokeWidth={2.5} fill={SERIES.buy} fillOpacity={0.14} isAnimationActive={false} />
                <ReferenceDot x={peak.year} y={peak.p} r={4.5} fill={INK.ground} stroke={SERIES.buy} strokeWidth={2}
                  label={{
                    value: `Peak ${formatPercent(peak.p)} at year ${peak.year}`,
                    position: peak.year > timeHorizon * 0.75 ? 'left' : 'top',
                    fill: INK.primary,
                    fontSize: 12,
                    offset: 10,
                  }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="m-0 text-[13px] text-ink-2">
            {timingNote}
          </p>
        </section>

        <section aria-label="Range of outcomes" className="flex min-w-0 flex-col gap-3.5 rounded-2xl bg-surface px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Spread</span>
            <h3 className="m-0 text-lg font-semibold">Middle 80% of futures at year {timeHorizon}</h3>
          </div>
          <SpreadStrip percentiles={results.percentiles} />
          <p className="m-0 text-[13px] text-ink-2">The dark band is the middle half. The line spans the 10th to the 90th percentile.</p>
        </section>
      </div>

      <p className="m-0 max-w-3xl text-xs leading-relaxed text-muted">
        Each future draws its own long-run averages plus correlated year-to-year swings in mortgage rates, share returns,
        property growth and rent. Volatility assumptions: shares 15% a year, property 7%, rent growth 1.5 points, rates
        mean-reverting.
      </p>
    </div>
  );
}
