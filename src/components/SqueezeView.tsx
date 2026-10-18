import { useDeferredValue, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { runComparison } from '../utils/calculations';
import { HOLD_YEARS, START_UNEMPLOYMENT, buildSqueezePaths, householdJobLossChance, longestSpell, type SqueezeOptions } from '../utils/squeeze';
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

const PEAKS = [
  { value: 6, label: 'Mild', note: 'like the early-2000s slowdown' },
  { value: 7.5, label: 'Central', note: 'about where it peaked after the GFC and in 2020' },
  { value: 10, label: 'Severe', note: 'close to the early-1990s recession (11%)' },
];
const JOB_LOSS = [
  { months: 0, label: 'No' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
];
const TAKE_HOME = 0.75;
const MONTE_CARLO_RUNS = 500;

const advantage = (s: { rentNetPositionAfterTax: number; mortgageNetPositionAfterSale: number }) =>
  s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;

function Pills<T extends string | number | boolean>({ label, value, options, onChange }: {
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
    peak: 7.5, start: 3, riseYears: 5, lasting: true, rateCuts: true, profitShift: true,
  });
  const [livingCosts, setLivingCosts] = useState(4500);
  const [jobLossMonths, setJobLossMonths] = useState(0);
  const [randomSpells, setRandomSpells] = useState(true);
  const grossIncome = income ?? 190000;
  const set = (patch: Partial<SqueezeOptions>) => setOptions({ ...options, ...patch });

  const deferred = useDeferredValue({ options, livingCosts, jobLossMonths, randomSpells, grossIncome });

  const model = useMemo(() => {
    const squeeze = buildSqueezePaths(property, rent, investment, horizon, options);
    const base = buildSqueezePaths(property, rent, investment, horizon, { ...options, peak: START_UNEMPLOYMENT });
    return {
      squeeze,
      base,
      squeezed: runComparison(property, rent, investment, horizon, squeeze),
      normal: runComparison(property, rent, investment, horizon, base),
    };
  }, [property, rent, investment, horizon, options]);

  const household = useMemo(() => {
    const { options: o, livingCosts: living, jobLossMonths: months, randomSpells: random, grossIncome: gross } = deferred;
    const paths = buildSqueezePaths(property, rent, investment, horizon, o);
    const hh = { grossIncome: gross, takeHome: TAKE_HOME, livingCosts: living };
    const spells: IncomeSpell[] = months > 0
      ? [{ startMonth: o.start * 12 + 1, months, incomeShare: 0.5, reskillCost: 15000, scarring: months >= 24 ? 0.15 : 0.075 }]
      : [];
    const result = simulateHousehold(property, rent, investment, horizon, paths, hh, { growth: paths.wages, spells });

    // Random spells: the yearly chance one earner is out of work, and how long for, follow unemployment
    const rng = createRng(7);
    let forced = 0;
    for (let i = 0; i < MONTE_CARLO_RUNS && random; i++) {
      const spells: IncomeSpell[] = [];
      for (let year = 2; year <= horizon; year++) {
        const u = paths.unemployment[year - 1];
        if (rng() < householdJobLossChance(u)) {
          spells.push({
            startMonth: (year - 1) * 12 + 1 + Math.floor(rng() * 12),
            months: 3 + Math.floor(rng() * (longestSpell(u) - 2)),
            incomeShare: 0.5 + rng() * 0.1,
            reskillCost: 5000 + rng() * 15000,
            scarring: rng() * 0.15,
          });
        }
      }
      if (simulateHousehold(property, rent, investment, horizon, paths, hh, { growth: paths.wages, spells }).forcedSaleMonth !== null) forced++;
    }
    return { result, forcedChance: random ? forced / MONTE_CARLO_RUNS : 0 };
  }, [property, rent, investment, horizon, deferred]);

  const squeezedGap = advantage(model.squeezed[sellYear]);
  const normalGap = advantage(model.normal[sellYear]);
  const shift = squeezedGap - normalGap;
  const householdGap = household.result.gap[sellYear];
  const sale = household.result.forcedSaleMonth;

  const pathData = model.squeeze.interestRate.map((_, i) => ({
    year: i + 1,
    unemployment: model.squeeze.unemployment[i], unemploymentBase: model.base.unemployment[i],
    income: model.squeeze.wages[i], incomeBase: model.base.wages[i],
    rate: model.squeeze.interestRate[i], rateBase: model.base.interestRate[i],
    house: model.squeeze.propertyGrowthRate[i], houseBase: model.base.propertyGrowthRate[i],
    rent: model.squeeze.rentIncreaseRate[i], rentBase: model.base.rentIncreaseRate[i],
    returns: model.squeeze.stockMarketReturn[i], returnsBase: model.base.stockMarketReturn[i],
  }));
  const minis: { key: 'unemployment' | 'income' | 'rate' | 'house' | 'rent' | 'returns'; title: string }[] = [
    { key: 'unemployment', title: 'Unemployment rate' },
    { key: 'income', title: 'Income growth (wages less jobs lost)' },
    { key: 'rate', title: 'Mortgage rate' },
    { key: 'house', title: 'Home price growth' },
    { key: 'rent', title: 'Rent growth' },
    { key: 'returns', title: 'Investment return' },
  ];

  // How far below the no-squeeze path home values and incomes fall, and when
  const valueRatios = model.squeezed.map((s, i) => s.mortgagePropertyValue / model.normal[i].mortgagePropertyValue);
  const topYear = Math.min(horizon, options.start + options.riseYears - 1);
  // Worst point while unemployment is climbing
  const climbYears = valueRatios.map((r, year) => ({ r, year })).filter(({ year }) => year >= options.start && year <= topYear);
  const climbWorst = climbYears.reduce((worst, x) => (x.r < worst.r ? x : worst), { r: 1, year: options.start });
  const atSale = valueRatios[sellYear];
  // Largest fall in dollar prices from an earlier high
  let high = 0;
  let nominalDip = 0;
  for (const s of model.squeezed) {
    high = Math.max(high, s.mortgagePropertyValue);
    nominalDip = Math.max(nominalDip, 1 - s.mortgagePropertyValue / high);
  }
  const incomeIndex = (growth: number[], year: number) => growth.slice(0, year).reduce((x, g) => x * (1 + g / 100), 1);
  // Shares lag too while unemployment climbs (capital deflation), measured at the top
  const sharesLag = 1 - incomeIndex(model.squeeze.stockMarketReturn, topYear) / incomeIndex(model.base.stockMarketReturn, topYear);
  const incomeGap = 1 - incomeIndex(model.squeeze.wages, sellYear) / incomeIndex(model.base.wages, sellYear);

  const gapData = model.squeezed.map((s, i) => ({ year: s.year, squeeze: advantage(s), normal: advantage(model.normal[i]) }));
  const gapTicks = niceTicks(Math.min(0, ...gapData.flatMap((d) => [d.squeeze, d.normal])), Math.max(0, ...gapData.flatMap((d) => [d.squeeze, d.normal])));
  const winner = (gap: number) => (gap > 0 ? 'Renting' : 'Buying');

  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-12 px-4 pt-8 pb-12 sm:px-6 sm:pt-12">
      <section aria-label="About this view" className="flex flex-col gap-3">
        <span className="eyebrow">Speculative fiction, with spreadsheets</span>
        <h1 className="m-0 text-4xl leading-none font-bold tracking-tighter sm:text-6xl">The AI squeeze</h1>
        <p className="m-0 max-w-2xl text-lg leading-relaxed text-ink-2">
          What if AI slowly pushes unemployment up? This is a toy model of that guess, written by an AI, about AI, so season
          generously with salt. It runs your current scenario through rising unemployment and what tends to follow: slower pay
          rises, fewer people earning, forced sellers, falling share prices, rate cuts that prop prices back up, and
          profits drifting from pay packets to shareholders.
        </p>
        <p className="m-0 text-sm font-medium text-ink-2">Every number here is an AI-generated estimate. Not financial advice.</p>
      </section>

      <section aria-label="Squeeze settings" className="card grid grid-cols-1 gap-8 px-5 py-6 sm:px-7 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">How high does unemployment go?</span>
            <Pills label="Peak unemployment" value={options.peak} onChange={(peak) => set({ peak })}
              options={PEAKS.map((x) => ({ value: x.value, label: `${x.label}, ${x.value}%` }))} />
            <span className="text-xs text-muted">
              From about {START_UNEMPLOYMENT}% today; {PEAKS.find((x) => x.value === options.peak)?.note}.
            </span>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Starts in year {options.start}</span>
            <input type="range" min={1} max={Math.min(10, horizon)} value={options.start}
              onChange={(e) => set({ start: Number(e.target.value) })} className="accent-[var(--color-ink)]" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Climbs gradually for {options.riseYears} {options.riseYears === 1 ? 'year' : 'years'}</span>
            <input type="range" min={1} max={10} value={options.riseYears}
              onChange={(e) => set({ riseYears: Number(e.target.value) })} className="accent-[var(--color-ink)]" />
            <span className="text-xs text-muted">Then it holds for {HOLD_YEARS} years before easing.</span>
          </label>
        </div>
        <div className="flex flex-col gap-4">
          <Toggle checked={options.rateCuts} onChange={(rateCuts) => set({ rateCuts })}
            title="The RBA cuts rates" detail="Weak wages and inflation bring cuts, which lift borrowing power and prices." />
          <Toggle checked={options.profitShift} onChange={(profitShift) => set({ profitShift })}
            title="Profits flow to shareholders" detail="What workers lose, company owners gain: global shares do best, Australian banks less so." />
          <Toggle checked={options.lasting} onChange={(lasting) => set({ lasting })}
            title="Some jobs don't come back" detail="Unemployment settles half way between today and the peak, instead of recovering fully." />
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
        <ul className="m-0 flex max-w-3xl list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
          <li>
            {climbWorst.r < 0.995
              ? <>While unemployment climbs, home values fall up to {Math.round((1 - climbWorst.r) * 100)}% behind where they'd otherwise be (year {climbWorst.year}).</>
              : <>While unemployment climbs, rate cuts keep home values on track.</>}
            {nominalDip >= 0.005 && <> In dollars, prices drop {Math.round(nominalDip * 100)}% from their high.</>}
            {' '}By year {sellYear} they're {Math.abs(Math.round((1 - atSale) * 100))}% {atSale <= 1 ? 'below' : 'above'} the no-squeeze path
            {options.rateCuts && atSale < climbWorst.r ? ', as rates rise back to normal on lower incomes.' : '.'}
          </li>
          <li>
            Household income from work ends up {Math.abs(Math.round(incomeGap * 100))}% {incomeGap >= 0 ? 'lower' : 'higher'} by year {sellYear}: slower
            pay rises, and fewer people in work.
          </li>
          {sharesLag >= 0.005 && (
            <li>
              Capital deflates too: by year {topYear} your investments are {Math.round(sharesLag * 100)}% behind where they'd otherwise
              be, as earnings fall with spending. Most of that comes back once unemployment stops rising.
            </li>
          )}
          {!options.rateCuts && <li>Without rate cuts nothing props prices up, so they track incomes down.</li>}
        </ul>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <ReferenceArea x1={options.start} x2={Math.min(horizon, options.start + options.riseYears - 1 + HOLD_YEARS)} fill={INK.primary} fillOpacity={0.05}
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
            Here each household lives on its income, and its pay follows the economy above. If the buyer can't cover the
            mortgage for three months they're forced to sell, at no more than the home was worth two years earlier and 5%
            under that, then rent instead.
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
            <span className="text-sm text-ink-2">Random spells out of work, as unemployment rises</span>
            <Pills label="Random job loss" value={randomSpells} onChange={setRandomSpells}
              options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]} />
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
            <span className="font-mono text-xl">{randomSpells ? `${Math.round(household.forcedChance * 100)}%` : '–'}</span>
            <span className="text-xs text-muted">{randomSpells
                ? `${MONTE_CARLO_RUNS} runs. Each year a ${Math.round(householdJobLossChance(START_UNEMPLOYMENT) * 100)}% chance one of you is out of work, rising to ${Math.round(householdJobLossChance(options.peak) * 100)}% at the peak`
                : 'Turn on random spells'}</span>
          </div>
        </div>
      </section>

      <details className="group rounded-2xl border border-line bg-surface px-5 py-4 sm:px-7">
        <summary className="cursor-pointer list-none text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
          How this toy works (and what it gets wrong)
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-ink-2">
          <p className="m-0">
            Unemployment climbs evenly from {START_UNEMPLOYMENT}% to the peak, holds for {HOLD_YEARS} years, then eases back,
            fully or half way. What drives everything is the gap between unemployment and the rate the economy has got used to,
            which drifts toward the actual rate over time, so a lasting rise stops pressing on wages and interest rates
            eventually but leaves fewer people in work for good.
          </p>
          <p className="m-0">
            Wage growth, taken to match your rent growth, falls 0.6 points per point of that gap (a rough Australian wage
            Phillips curve). Income from work also shrinks as people lose jobs. The cash rate is cut 1.5 points per point of
            gap, moving half way each year, and mortgage rates follow. Home prices track income growth, a supply term, and
            borrowing power from rate cuts, which reaches prices a quarter at a time. While unemployment is rising, forced
            sales and caution take 5% off prices per point of rise, and half of that comes back afterwards. Rents follow
            wages, less a point per point of rise as people move in together. Share prices fall 8% per point of rise (less for
            balanced funds, not at all for cash), and 60% of that comes back once unemployment stops rising.
          </p>
          <p className="m-0">
            For comparison: unemployment hit 11% in the early 1990s with rates cut from 17% to under 5%, and prices barely
            moved in dollars. Around the GFC prices dipped about 4% and then jumped on rate cuts and grants.
          </p>
          <p className="m-0">
            Not modelled: tax brackets (take-home pay is a flat {TAKE_HOME * 100}%), government support, banks tightening
            lending beyond the slow pass-through, or buying again after a forced sale.
            The sizes are rough guesses, not estimates from research.
          </p>
        </div>
      </details>
    </main>
  );
}
