import { useDeferredValue, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { runComparison } from '../utils/calculations';
import { buildSqueezePaths, type SqueezeOptions } from '../utils/squeeze';
import { simulateHousehold, type IncomeSpell } from '../utils/household';
import { createRng } from '../utils/distributions';
import { formatAdvantage, formatCompactCurrency, formatCurrency } from '../utils/format';
import { AdornedInput } from './InputField';
import { niceTicks, useChart, yearTicks } from './chartTheme';

interface SqueezeViewProps {
  property: PropertyInputs;
  rent: RentInputs;
  investment: InvestmentInputs;
  horizon: number;
  sellYear: number;
  onSellYearChange: (year: number) => void;
  income: number | null;
  onIncomeChange: (income: number | null) => void;
}

const SEVERITIES = [
  { value: 0.5, label: 'Mild', note: 'real wages −0.5% a year' },
  { value: 1, label: 'Central', note: 'real wages −1% a year' },
  { value: 2, label: 'Severe', note: 'real wages −2% a year' },
];
const JOB_LOSS = [
  { months: 0, label: 'No' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
];
const RISKS = [0, 0.03, 0.08, 0.15];
const SQUEEZE_LENGTH = 9;
const TAKE_HOME = 0.75;
const MONTE_CARLO_RUNS = 500;

const advantage = (s: { rentNetPositionAfterTax: number; mortgageNetPositionAfterSale: number }) =>
  s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;

function Pills<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-full px-4 text-sm ${
            o.value === value ? 'bg-ink font-semibold text-ground' : 'border border-line-strong bg-surface text-ink-2 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, title, detail }: { checked: boolean; onChange: (v: boolean) => void; title: string; detail: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-line-strong transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink after:absolute after:top-1 after:left-1 after:h-4 after:w-4 after:rounded-full after:bg-surface after:transition-transform peer-checked:after:translate-x-4" />
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium">{title}</span>
        <span className="text-[13px] leading-snug text-muted">{detail}</span>
      </span>
    </label>
  );
}

export default function SqueezeView({
  property,
  rent,
  investment,
  horizon,
  sellYear,
  onSellYearChange,
  income,
  onIncomeChange,
}: SqueezeViewProps) {
  const { INK, SERIES, axisProps, gridProps, tooltipProps } = useChart();
  const [options, setOptions] = useState<SqueezeOptions>({
    severity: 1, start: 4, length: SQUEEZE_LENGTH, rateCuts: true, profitShift: true, slump: false,
  });
  const [livingCosts, setLivingCosts] = useState(4500);
  const [jobLossMonths, setJobLossMonths] = useState(0);
  const [risk, setRisk] = useState(0.08);
  const grossIncome = income ?? 190000;
  const set = (patch: Partial<SqueezeOptions>) => setOptions({ ...options, ...patch });

  const deferred = useDeferredValue({ options, livingCosts, jobLossMonths, risk, grossIncome });

  const model = useMemo(() => {
    const squeeze = buildSqueezePaths(property, rent, investment, horizon, options);
    const base = buildSqueezePaths(property, rent, investment, horizon, { ...options, severity: 0 });
    return {
      squeeze,
      base,
      squeezed: runComparison(property, rent, investment, horizon, squeeze),
      normal: runComparison(property, rent, investment, horizon, base),
    };
  }, [property, rent, investment, horizon, options]);

  const household = useMemo(() => {
    const { options: o, livingCosts: living, jobLossMonths: months, risk: chance, grossIncome: gross } = deferred;
    // Job losses come with a falling market, whatever the slump toggle says
    const paths = buildSqueezePaths(property, rent, investment, horizon, { ...o, slump: true });
    const hh = { grossIncome: gross, takeHome: TAKE_HOME, livingCosts: living };
    const spells: IncomeSpell[] = months > 0
      ? [{ startMonth: o.start * 12 + 1, months, incomeShare: 0.5, reskillCost: 15000, scarring: months >= 24 ? 0.15 : 0.075 }]
      : [];
    const result = simulateHousehold(property, rent, investment, horizon, paths, hh, { growth: paths.wages, spells });

    // Random spells: each year there's a `chance` one earner is out for 3-18 months
    const rng = createRng(7);
    let forced = 0;
    for (let i = 0; i < MONTE_CARLO_RUNS && chance > 0; i++) {
      const random: IncomeSpell[] = [];
      for (let year = 2; year <= horizon; year++) {
        if (rng() < chance) {
          random.push({
            startMonth: (year - 1) * 12 + 1 + Math.floor(rng() * 12),
            months: 3 + Math.floor(rng() * 16),
            incomeShare: 0.5 + rng() * 0.1,
            reskillCost: 5000 + rng() * 15000,
            scarring: rng() * 0.15,
          });
        }
      }
      if (simulateHousehold(property, rent, investment, horizon, paths, hh, { growth: paths.wages, spells: random }).forcedSaleMonth !== null) forced++;
    }
    return { result, forcedChance: chance > 0 ? forced / MONTE_CARLO_RUNS : 0 };
  }, [property, rent, investment, horizon, deferred]);

  const squeezedGap = advantage(model.squeezed[sellYear]);
  const normalGap = advantage(model.normal[sellYear]);
  const shift = squeezedGap - normalGap;
  const householdGap = household.result.gap[sellYear];
  const sale = household.result.forcedSaleMonth;

  const pathData = model.squeeze.interestRate.map((_, i) => ({
    year: i + 1,
    rate: model.squeeze.interestRate[i], rateBase: model.base.interestRate[i],
    house: model.squeeze.propertyGrowthRate[i], houseBase: model.base.propertyGrowthRate[i],
    rent: model.squeeze.rentIncreaseRate[i], rentBase: model.base.rentIncreaseRate[i],
    returns: model.squeeze.stockMarketReturn[i], returnsBase: model.base.stockMarketReturn[i],
  }));
  const minis: { key: 'rate' | 'house' | 'rent' | 'returns'; title: string }[] = [
    { key: 'rate', title: 'Mortgage rate' },
    { key: 'house', title: 'Home price growth' },
    { key: 'rent', title: 'Rent growth (≈ wages)' },
    { key: 'returns', title: 'Investment return' },
  ];

  const gapData = model.squeezed.map((s, i) => ({ year: s.year, squeeze: advantage(s), normal: advantage(model.normal[i]) }));
  const gapTicks = niceTicks(Math.min(0, ...gapData.flatMap((d) => [d.squeeze, d.normal])), Math.max(0, ...gapData.flatMap((d) => [d.squeeze, d.normal])));
  const winner = (gap: number) => (gap > 0 ? 'Renting' : 'Buying');

  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-12 px-4 pt-8 pb-20 sm:px-6 sm:pt-12">
      <section aria-label="About this view" className="flex flex-col gap-3">
        <span className="eyebrow">Speculative fiction, with spreadsheets</span>
        <h1 className="m-0 text-4xl leading-none font-bold tracking-tighter sm:text-6xl">The AI squeeze</h1>
        <p className="m-0 max-w-2xl text-lg leading-relaxed text-ink-2">
          What if AI flattens wages? This is a toy model of that guess, written by an AI, about AI, so season generously
          with salt. It runs your current scenario through slower wages, the rate cuts that would likely follow, and profits
          drifting from pay packets to shareholders.
        </p>
        <p className="m-0 text-sm font-medium text-ink-2">Every number here is an AI-generated estimate. Not financial advice.</p>
      </section>

      <section aria-label="Squeeze settings" className="card grid grid-cols-1 gap-8 px-5 py-6 sm:px-7 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">How hard does it bite?</span>
            <Pills label="Severity" value={options.severity} onChange={(severity) => set({ severity })}
              options={SEVERITIES.map((s) => ({ value: s.value, label: s.label }))} />
            <span className="text-xs text-muted">
              {SEVERITIES.find((s) => s.value === options.severity)?.note}, for {SQUEEZE_LENGTH} years
            </span>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Starts in year {options.start}</span>
            <input type="range" min={1} max={Math.min(10, horizon)} value={options.start}
              onChange={(e) => set({ start: Number(e.target.value) })} className="accent-[var(--color-ink)]" />
          </label>
        </div>
        <div className="flex flex-col gap-4">
          <Toggle checked={options.rateCuts} onChange={(rateCuts) => set({ rateCuts })}
            title="The RBA cuts rates" detail="Weak wages and inflation bring cuts, which lift borrowing power and prices." />
          <Toggle checked={options.profitShift} onChange={(profitShift) => set({ profitShift })}
            title="Profits flow to shareholders" detail="What workers lose, company owners gain: global shares do best, Australian banks less so." />
          <Toggle checked={options.slump} onChange={(slump) => set({ slump })}
            title="Prices slump when layoffs hit" detail="Prices fall for two years (5% a year per point of lost wage growth) before rate cuts catch up." />
        </div>
      </section>

      <section aria-label="Result" aria-live="polite" className="flex flex-col gap-4">
        <span className="eyebrow">If you sell after {sellYear} years</span>
        <h2 className="m-0 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          {winner(squeezedGap)}, by{' '}
          <span className={`font-mono font-medium ${squeezedGap > 0 ? 'text-rent' : 'text-buy'}`}>{formatCompactCurrency(Math.abs(squeezedGap))}</span>.
        </h2>
        <p className="m-0 max-w-3xl text-lg leading-relaxed text-ink-2">
          Without the squeeze it's {winner(normalGap).toLowerCase()} by {formatCompactCurrency(Math.abs(normalGap))}, so the squeeze moves
          things {formatCompactCurrency(Math.abs(shift))} toward {shift > 0 ? 'renting' : 'buying'}. Home values reach{' '}
          {formatCompactCurrency(model.squeezed[sellYear].mortgagePropertyValue)} instead of {formatCompactCurrency(model.normal[sellYear].mortgagePropertyValue)}.
        </p>
        <label className="flex max-w-md items-center gap-3 text-sm text-muted">
          Sell after
          <input type="range" min={1} max={horizon} value={sellYear} onChange={(e) => onSellYearChange(Number(e.target.value))}
            className="flex-1 accent-[var(--color-ink)]" aria-valuetext={`${sellYear} years`} />
          <span className="font-mono text-ink">{sellYear} yrs</span>
        </label>
      </section>

      <section aria-label="What the squeeze changes" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-xl font-semibold">What the squeeze does to the inputs</h2>
          <span className="flex items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-2"><svg width="22" height="4" aria-hidden><line x1="0" x2="22" y1="2" y2="2" stroke={INK.primary} strokeWidth="2.5" /></svg>Squeeze</span>
            <span className="flex items-center gap-2"><svg width="22" height="4" aria-hidden><line x1="0" x2="22" y1="2" y2="2" stroke={INK.muted} strokeWidth="1.5" strokeDasharray="4 3" /></svg>Without</span>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {minis.map((mini) => (
            <div key={mini.key} className="card flex flex-col gap-2 px-4 pt-4 pb-2">
              <span className="text-sm font-semibold">{mini.title}</span>
              <div className="h-[130px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pathData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="year" {...axisProps} ticks={yearTicks(horizon).filter((y) => y > 0)} interval={0} />
                    <YAxis {...axisProps} width={44} tickFormatter={(v: number) => `${Number(v.toFixed(1))}%`} domain={['auto', 'auto']} />
                    <Tooltip {...tooltipProps} labelFormatter={(y) => `Year ${y}`}
                      formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]} />
                    <Line dataKey={`${mini.key}Base`} name="Without" stroke={INK.muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                    <Line dataKey={mini.key} name="Squeeze" stroke={INK.primary} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Who is ahead" className="card flex flex-col gap-4 px-4 py-6 sm:px-7">
        <h2 className="m-0 text-xl font-semibold">Who's ahead, with and without the squeeze</h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gapData} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
              <ReferenceArea y1={0} y2={gapTicks[gapTicks.length - 1]} fill={SERIES.rent} fillOpacity={0.06} ifOverflow="extendDomain"
                label={{ value: 'Renting ahead ↑', position: 'insideTopLeft', fill: INK.secondary, fontSize: 13, fontWeight: 600 }} />
              <ReferenceArea y1={gapTicks[0]} y2={0} fill={SERIES.buy} fillOpacity={0.06} ifOverflow="extendDomain"
                label={{ value: 'Buying ahead ↓', position: 'insideBottomLeft', fill: INK.secondary, fontSize: 13, fontWeight: 600 }} />
              <XAxis dataKey="year" {...axisProps} ticks={yearTicks(horizon)} interval={0} tickFormatter={(y: number) => (y === 0 ? 'Now' : String(y))} />
              <YAxis {...axisProps} width={60} domain={[gapTicks[0], gapTicks[gapTicks.length - 1]]} ticks={gapTicks}
                tickFormatter={(v: number) => (v === 0 ? 'Even' : formatCompactCurrency(v))} />
              <ReferenceLine y={0} stroke={INK.muted} />
              <ReferenceArea x1={options.start} x2={Math.min(horizon, options.start + SQUEEZE_LENGTH)} fill={INK.primary} fillOpacity={0.05}
                label={{ value: 'Squeeze', position: 'insideTop', fill: INK.muted, fontSize: 12 }} />
              <Tooltip {...tooltipProps} labelFormatter={(y) => `Sell in year ${y}`} formatter={(v: number, name: string) => [formatAdvantage(v), name]} />
              <Line dataKey="normal" name="Without" stroke={INK.muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              <Line dataKey="squeeze" name="Squeeze" stroke={INK.primary} strokeWidth={3} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section aria-label="Your household" className="card flex flex-col gap-6 px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-xl font-semibold">Now add your own job to the mix</h2>
          <p className="m-0 text-[15px] text-ink-2">
            Here each household lives on its income. Job losses come with a falling market: prices drop for the first two
            years of the squeeze. If the buyer can't cover the mortgage for three months they're forced to sell, at no more
            than the home was worth two years earlier and 5% under that, then rent instead.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-2">Household income before tax</span>
            <AdornedInput ariaLabel="Household income before tax" format="currency" value={grossIncome}
              onChange={(v) => onIncomeChange(v > 0 ? v : null)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-2">Other living costs per month</span>
            <AdornedInput ariaLabel="Other living costs per month" format="currency" value={livingCosts} onChange={setLivingCosts} />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink-2">One earner out of work when the squeeze starts</span>
            <Pills label="Job loss" value={jobLossMonths} onChange={setJobLossMonths}
              options={JOB_LOSS.map((j) => ({ value: j.months, label: j.label }))} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink-2">Chance of a spell out of work, each year</span>
            <Pills label="Job loss risk" value={risk} onChange={setRisk}
              options={RISKS.map((r) => ({ value: r, label: `${r * 100}%` }))} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-ink-2">The buyer</span>
            <span className="font-mono text-xl">{sale === null ? 'Hangs on' : `Forced to sell, yr ${Math.ceil(sale / 12)}`}</span>
            <span className="text-xs text-muted">
              {household.result.buyerMinBuffer === Infinity
                ? ''
                : `Lowest cash buffer: ${formatCurrency(household.result.buyerMinBuffer)}`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-ink-2">Result after {sellYear} years</span>
            <span className="font-mono text-xl">{formatAdvantage(householdGap)}</span>
            <span className="text-xs text-muted">With your income and any job loss</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-ink-2">Chance of a forced sale</span>
            <span className="font-mono text-xl">{risk > 0 ? `${Math.round(household.forcedChance * 100)}%` : '–'}</span>
            <span className="text-xs text-muted">{risk > 0 ? `${MONTE_CARLO_RUNS} runs with random spells of 3-18 months` : 'Pick a job-loss risk'}</span>
          </div>
        </div>
      </section>

      <details className="group rounded-2xl border border-line bg-surface px-5 py-4 sm:px-7">
        <summary className="cursor-pointer list-none text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
          How this toy works (and what it gets wrong)
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-ink-2">
          <p className="m-0">
            Starting from your inputs, wage growth is assumed to match your rent growth. During the squeeze real wages fall
            by the chosen amount for {SQUEEZE_LENGTH} years and a quarter of that lingers. Rents follow wages. The cash rate is cut
            1.5 points per point of lost wage growth, phased in over two years, and mortgage rates follow. Home prices follow
            borrowing capacity: wage growth, plus a supply term, plus the boost from lower rates. With profits shifting to
            shareholders, returns rise per point of lost wage growth: +1.5 for global shares, +2 for US, −0.5 for Australian.
          </p>
          <p className="m-0">
            Not modelled: tax brackets (take-home pay is a flat {TAKE_HOME * 100}%), government support, buying again after a forced
            sale, or how many people a squeeze puts out of work. The profit shift and slump sizes are guesses, not research.
          </p>
        </div>
      </details>
    </main>
  );
}
