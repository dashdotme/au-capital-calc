import { useState, type ReactNode } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BreakEvenResult, InvestmentInputs, PropertyInputs, RentInputs, ScenarioResults, YearlySnapshot } from '../types';
import type { GapDriver } from '../utils/gap';
import { CITIES, applyCity } from '../cities';
import { calculateStampDuty, stampDutyBasis } from '../utils/stampDuty';
import { NEW_HOME_GROWTH_NOTE, depositNote, firstHomeGrant } from '../utils/homeBuyerSupport';
import { NEW_HOME_DRAG_YEARS, NEW_HOME_GROWTH_DRAG } from '../utils/calculations';
import NewHomeGrowthSources from './NewHomeGrowthSources';
import { PORTFOLIOS, applyPortfolio } from '../portfolios';
import { formatAdvantage, formatCompactCurrency, formatCurrency } from '../utils/format';
import { INVESTED_SHARE_NOTE, PORTFOLIO_PHRASES, describeFlip, describeTiming, investedPhrase, whyCards, winnerAt } from '../utils/narrative';
import { AdornedInput } from './InputField';
import SentencePill from './SentencePill';
import GapExplainer from './GapExplainer';
import { niceTicks, useChart, yearTicks } from './chartTheme';
import { DISCLAIMER_SHORT } from '../site';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface SentenceViewProps {
  property: PropertyInputs;
  rent: RentInputs;
  investment: InvestmentInputs;
  horizon: number;
  sellYear: number;
  realTerms: boolean;
  /** Snapshots in the displayed dollar basis */
  baseline: YearlySnapshot[];
  scenarios: ScenarioResults | null;
  breakEvens: BreakEvenResult[];
  drivers: GapDriver[];
  changeFlash: { delta: number; at: number } | null;
  onPropertyAndRentChange: (property: PropertyInputs, rent: RentInputs) => void;
  onInvestmentChange: (investment: InvestmentInputs) => void;
  onSellYearChange: (year: number) => void;
  onOpenAssumptions: () => void;
  onOpenGuide: () => void;
  onOpenRisk: () => void;
  affordability: ReactNode;
  savedScenarios: ReactNode;
  portfolioComparison: ReactNode;
  /** Price-to-income warning, shown under the answer when growth looks stretched */
  realityCheck?: ReactNode;
}

type Panel = 'afford' | 'compare' | 'markets' | null;

const advantage = (s: YearlySnapshot) => s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;

const INVESTED_SHARES = [
  { value: 100, label: 'All of it' },
  { value: 75, label: 'Most of it' },
  { value: 50, label: 'Half' },
  { value: 25, label: 'A quarter' },
  { value: 0, label: 'None, spend it' },
];

function ChoiceList<T extends string>({ options, value, onPick }: {
  options: { value: T; label: string; detail?: string }[];
  value: T | undefined;
  onPick: (value: T) => void;
}) {
  return (
    <span className="flex max-h-72 flex-col gap-1 overflow-y-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          aria-pressed={o.value === value}
          className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-left text-sm ${
            o.value === value ? 'bg-raised font-semibold' : 'hover:bg-raised'
          }`}
        >
          <span>{o.label}</span>
          {o.detail && <span className="font-mono text-xs text-muted">{o.detail}</span>}
        </button>
      ))}
    </span>
  );
}

export default function SentenceView({
  property: p,
  rent: r,
  investment: inv,
  horizon,
  sellYear,
  realTerms,
  baseline,
  scenarios,
  breakEvens,
  drivers,
  changeFlash,
  onPropertyAndRentChange,
  onInvestmentChange,
  onSellYearChange,
  onOpenAssumptions,
  onOpenGuide,
  onOpenRisk,
  affordability,
  savedScenarios,
  portfolioComparison,
  realityCheck,
}: SentenceViewProps) {
  const { INK, SERIES, axisProps, tooltipProps } = useChart();
  const wide = useMediaQuery('(min-width: 640px)');
  const [panel, setPanel] = useState<Panel>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const city = CITIES.find((c) => c.id === p.location);
  const dutyState = p.state;
  /** Stamp duty and grant if this home were new or established: "$0 duty · $30k grant" */
  const homeDetail = (newHome: boolean) => {
    const option = { ...p, newHome };
    const duty = dutyState ? calculateStampDuty(dutyState, p.propertyPrice, p.firstHomeBuyer ?? false, newHome) : p.stampDuty;
    const grant = firstHomeGrant(option);
    return `${formatCompactCurrency(duty)} duty${grant > 0 ? ` · ${formatCompactCurrency(grant)} grant` : ''}`;
  };
  const final = baseline[sellYear];
  const winner = winnerAt(final);
  const gap = Math.abs(advantage(final));
  const rate = typeof p.interestRate === 'number' ? p.interestRate : p.interestRate.baseline;
  const growth = typeof inv.propertyGrowthRate === 'number' ? inv.propertyGrowthRate : inv.propertyGrowthRate.baseline;

  const setProperty = (patch: Partial<PropertyInputs>) => onPropertyAndRentChange({ ...p, ...patch, location: undefined }, r);

  // Chart: baseline advantage, with the pessimistic-optimistic range shaded when scenarios are on
  const data = baseline.map((s, i) => {
    const values = scenarios ? [advantage(scenarios.pessimistic[i]), advantage(scenarios.optimistic[i]), advantage(s)] : [advantage(s)];
    return { year: s.year, base: advantage(s), range: [Math.min(...values), Math.max(...values)] as [number, number] };
  });
  const all = data.flatMap((d) => d.range);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));

  const pillsAnswer = (
    <div className="m-0 max-w-[980px] text-[22px] leading-[1.65] font-medium tracking-tight text-ink-2 sm:text-[32px] sm:leading-[1.55]">
      I could buy a{' '}
      <SentencePill label={formatCurrency(p.propertyPrice)} title="Purchase price">
        {() => (
          <span className="flex flex-col gap-2">
            <AdornedInput ariaLabel="Purchase price" format="currency" value={p.propertyPrice}
              onChange={(propertyPrice) => setProperty({ propertyPrice })} />
            {city && <span className="text-xs text-muted">{city.name} median: {formatCurrency(city.price)}</span>}
            <span className="text-xs text-muted">Stamp duty {formatCurrency(p.stampDuty)}. {stampDutyBasis(p.state, p.firstHomeBuyer ?? false)}</span>
            {(p.firstHomeGrant ?? 0) > 0 && <span className="text-xs text-muted">First home owner grant {formatCurrency(p.firstHomeGrant ?? 0)}.</span>}
          </span>
        )}
      </SentencePill>{' '}
      {dutyState ? (
        <SentencePill label={p.newHome ? 'new home' : 'established home'} title="Home">
          {(close) => (
            <span className="flex flex-col gap-2">
              <ChoiceList
                value={p.newHome ? 'new' : 'established'}
                options={[
                  { value: 'established', label: 'Established home', detail: homeDetail(false) },
                  { value: 'new', label: 'New home', detail: homeDetail(true) },
                ]}
                onPick={(choice) => {
                  onPropertyAndRentChange({ ...p, newHome: choice === 'new' }, r);
                  close();
                }}
              />
              <span className="max-w-72 text-xs leading-snug text-muted">{NEW_HOME_GROWTH_NOTE}</span>
            </span>
          )}
        </SentencePill>
      ) : 'home'}{' '}
      in{' '}
      <SentencePill label={city?.name ?? 'my area'} title="Location">
        {(close) => (
          <ChoiceList
            value={p.location}
            options={CITIES.map((c) => ({ value: c.id, label: c.name, detail: formatCompactCurrency(c.price) }))}
            onPick={(id) => {
              const picked = CITIES.find((c) => c.id === id);
              if (picked) onPropertyAndRentChange(...applyCity(p, r, picked));
              close();
            }}
          />
        )}
      </SentencePill>{' '}
      {dutyState && (
        <>
          <SentencePill label={p.firstHomeBuyer ? 'as a first home buyer' : 'having owned before'} title="Buyer">
            {(close) => (
              <ChoiceList
                value={p.firstHomeBuyer ? 'first' : 'owned'}
                options={[
                  { value: 'first', label: 'First home buyer', detail: `${formatCompactCurrency(calculateStampDuty(dutyState, p.propertyPrice, true, p.newHome))} duty` },
                  { value: 'owned', label: 'Owned before', detail: `${formatCompactCurrency(calculateStampDuty(dutyState, p.propertyPrice, false, p.newHome))} duty` },
                ]}
                onPick={(choice) => {
                  onPropertyAndRentChange({ ...p, firstHomeBuyer: choice === 'first' }, r);
                  close();
                }}
              />
            )}
          </SentencePill>{' '}
        </>
      )}
      with{' '}
      <SentencePill label={formatCurrency(p.deposit)} title="Deposit">
        {() => (
          <span className="flex flex-col gap-2">
            <AdornedInput ariaLabel="Deposit" format="currency" value={p.deposit}
              onChange={(deposit) => onPropertyAndRentChange({ ...p, deposit }, r)} />
            <span className="text-xs text-muted">
              {p.propertyPrice > 0 ? `${Math.round((p.deposit / p.propertyPrice) * 100)}% of the price` : ''}
              {p.deposit < p.propertyPrice * 0.2 ? ` · ${depositNote(p)}` : ''}
            </span>
          </span>
        )}
      </SentencePill>{' '}
      down, or keep renting at{' '}
      <SentencePill label={`${formatCurrency(r.monthlyRent)} a month`} title="Rent per month">
        {() => (
          <span className="flex flex-col gap-2">
            <AdornedInput ariaLabel="Rent per month" format="currency" value={r.monthlyRent}
              onChange={(monthlyRent) => onPropertyAndRentChange({ ...p, location: undefined }, { ...r, monthlyRent })} />
            <span className="text-xs text-muted">About {formatCurrency((r.monthlyRent * 12) / 52)} a week, for a similar home.</span>
          </span>
        )}
      </SentencePill>{' '}
      and invest{' '}
      <SentencePill label={investedPhrase(inv.investedShare)} title="Share of the monthly saving invested">
        {(close) => (
          <span className="flex flex-col gap-2">
            <ChoiceList
              value={String(inv.investedShare ?? 100)}
              options={INVESTED_SHARES.map((x) => ({ value: String(x.value), label: x.label, detail: `${x.value}%` }))}
              onPick={(value) => {
                onInvestmentChange({ ...inv, investedShare: Number(value) });
                close();
              }}
            />
            <span className="text-xs leading-snug text-muted">{INVESTED_SHARE_NOTE}</span>
          </span>
        )}
      </SentencePill>{' '}
      in{' '}
      <span className="whitespace-nowrap">
      <SentencePill label={(inv.portfolio && PORTFOLIO_PHRASES[inv.portfolio]) ?? 'my own mix'} title="Invest the savings in">
        {(close) => (
          <ChoiceList
            value={inv.portfolio}
            options={PORTFOLIOS.map((x) => ({ value: x.id, label: x.name, detail: `${x.returns.baseline}%` }))}
            onPick={(id) => {
              const preset = PORTFOLIOS.find((x) => x.id === id);
              if (preset) onInvestmentChange(applyPortfolio(inv, preset));
              close();
            }}
          />
        )}
      </SentencePill>.
      </span>{' '}
      If I sell after{' '}
      <span className="whitespace-nowrap">
      <SentencePill label={`${sellYear} ${sellYear === 1 ? 'year' : 'years'}`} title="Sell after">
        {() => (
          <span className="flex flex-col gap-3">
            <input type="range" min={1} max={horizon} value={sellYear}
              onChange={(e) => onSellYearChange(Number(e.target.value))}
              aria-label="Years until you sell" aria-valuetext={`${sellYear} years`}
              className="w-full accent-[var(--color-ink)]" />
            <span className="font-mono text-sm">{sellYear} of {horizon} years</span>
          </span>
        )}
      </SentencePill>,
      </span>{' '}
      which leaves me better off?
    </div>
  );

  const cards = whyCards(baseline, sellYear, drivers, inv.investedShare);
  const toggle = (next: Panel) => setPanel(panel === next ? null : next);
  const actions: { id: Panel | 'risk' | 'more'; label: string; primary?: boolean }[] = [
    { id: 'more', label: 'More assumptions', primary: true },
    { id: 'risk', label: 'Give me the odds' },
    { id: 'afford', label: 'Can I afford to buy?' },
    { id: 'markets', label: 'Try another investment' },
    { id: 'compare', label: 'Compare scenarios' },
  ];

  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-14 px-4 pt-6 pb-20 sm:px-6 sm:pt-10">
      <section aria-label="Your situation" className="flex flex-col gap-4">
        {pillsAnswer}
        <p className="m-0 text-sm text-muted">
          Tap any underlined value to change it. Mortgage rate {rate}%, home price growth {growth}%
          {p.newHome && (
            <> ({+(growth - NEW_HOME_GROWTH_DRAG).toFixed(2)}% for the first {NEW_HOME_DRAG_YEARS} years, as it's new: <NewHomeGrowthSources label="why" />)</>
          )} and the rest are under{' '}
          <button type="button" onClick={onOpenAssumptions} className="underline underline-offset-4 hover:text-ink">More assumptions</button>.
          {' '}New here?{' '}
          <button type="button" onClick={onOpenGuide} className="underline underline-offset-4 hover:text-ink">Answer four quick questions</button>.
        </p>
      </section>

      <section aria-label="Answer" aria-live="polite" className="flex flex-col gap-5">
        <h1 className="m-0 text-5xl leading-none font-bold tracking-tighter sm:text-7xl">
          {winner === 'even' ? (
            'About even.'
          ) : (
            <>
              {winner === 'rent' ? 'Renting' : 'Buying'}, by{' '}
              <span className={`font-mono font-medium ${winner === 'rent' ? 'text-rent' : 'text-buy'}`}>{formatCompactCurrency(gap)}</span>.
            </>
          )}
        </h1>
        <p className="m-0 max-w-3xl text-lg leading-relaxed text-ink-2 sm:text-xl">
          {describeTiming(baseline, sellYear)} {describeFlip(breakEvens, winner)}
        </p>
        <div className="min-h-7">
          {changeFlash && Math.abs(changeFlash.delta) >= 500 && (
            <span key={changeFlash.at} className="change-flash inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-[13px]">
              <span aria-hidden className={`h-2 w-2 rounded-full ${changeFlash.delta > 0 ? 'bg-rent' : 'bg-buy'}`} />
              Your change moved it <span className="font-mono">{formatCompactCurrency(Math.abs(changeFlash.delta))}</span> toward{' '}
              {changeFlash.delta > 0 ? 'renting' : 'buying'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          {[
            { label: 'Renting and investing', value: final.rentNetPositionAfterTax, swatch: 'bg-rent' },
            { label: 'Buying', value: final.mortgageNetPositionAfterSale, swatch: 'bg-buy' },
          ].map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm text-muted"><span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${row.swatch}`} />{row.label}</span>
              <span className="font-mono text-2xl sm:text-3xl">{formatCurrency(row.value)}</span>
            </div>
          ))}
          <span className="pb-1.5 text-sm text-muted">
            Net worth after selling everything and paying tax{realTerms ? ", in today's dollars" : ''}
          </span>
        </div>
        <p className="m-0 inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 7.2v4M8 4.8v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          {DISCLAIMER_SHORT}
        </p>
        {realityCheck}
      </section>

      <section aria-label="If you sold earlier" className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-xl font-semibold">If you sold earlier</h2>
          <span className="text-sm text-muted">
            {scenarios ? 'Shaded: range across pessimistic and optimistic markets. ' : ''}Click a year to sell then.
          </span>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 12, right: wide ? 24 : 8, bottom: 4, left: 4 }}
              onClick={(state: { activeTooltipIndex?: number | string | null } | null) => {
                const year = Number(state?.activeTooltipIndex);
                if (Number.isFinite(year) && year >= 1) onSellYearChange(year);
              }}
              className="cursor-crosshair"
            >
              <ReferenceArea y1={0} y2={ticks[ticks.length - 1]} fill={SERIES.rent} fillOpacity={0.06} ifOverflow="extendDomain"
                label={{ value: 'Renting ahead ↑', position: 'insideTopLeft', fill: INK.secondary, fontSize: 13, fontWeight: 600 }} />
              <ReferenceArea y1={ticks[0]} y2={0} fill={SERIES.buy} fillOpacity={0.06} ifOverflow="extendDomain"
                label={{ value: 'Buying ahead ↓', position: 'insideBottomLeft', fill: INK.secondary, fontSize: 13, fontWeight: 600 }} />
              <XAxis dataKey="year" {...axisProps} ticks={yearTicks(horizon)} interval={0}
                tickFormatter={(y: number) => (y === 0 ? 'Now' : wide ? `Yr ${y}` : String(y))} />
              <YAxis {...axisProps} width={60} domain={[ticks[0], ticks[ticks.length - 1]]} ticks={ticks}
                tickFormatter={(v: number) => (v === 0 ? 'Even' : formatCompactCurrency(v))} />
              <ReferenceLine y={0} stroke={INK.muted} />
              {sellYear < horizon && <ReferenceLine x={sellYear} stroke={INK.secondary} strokeDasharray="2 3" />}
              <Tooltip
                {...tooltipProps}
                labelFormatter={(y) => `Sell in year ${y}`}
                formatter={(value: number | number[], name: string) =>
                  Array.isArray(value) ? [`${formatAdvantage(value[0])} to ${formatAdvantage(value[1])}`, 'Range'] : [formatAdvantage(value), name]
                }
              />
              {scenarios && <Area dataKey="range" stroke="none" fill={INK.primary} fillOpacity={0.08} isAnimationActive={false} name="Range" />}
              <Line dataKey="base" name="Baseline" stroke={INK.primary} strokeWidth={3} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section aria-label="Why" className="flex flex-col gap-5">
        <h2 className="m-0 text-2xl font-bold tracking-tight sm:text-[28px]">
          {winner === 'even' ? 'Why it is so close' : `Why ${winner === 'rent' ? 'renting' : 'buying'} wins here`}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <div key={card.text} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-5 py-5">
              <span className="font-mono text-2xl">{card.figure}</span>
              <span className="text-[15px] leading-snug text-ink-2">{card.text}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowBreakdown(!showBreakdown)}
          aria-expanded={showBreakdown}
          className="min-h-11 self-start rounded-full border border-line-strong bg-surface px-5 text-[15px] hover:border-ink-2"
        >
          {showBreakdown ? 'Hide the full breakdown' : 'Show the full breakdown'}
        </button>
        {showBreakdown && <GapExplainer drivers={drivers} sellYear={sellYear} />}
      </section>

      <section aria-label="Go further" className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-3">
          {actions.map((a) => {
            const active = a.id === panel;
            return (
              <button
                key={a.id}
                type="button"
                aria-expanded={a.id === 'afford' || a.id === 'markets' || a.id === 'compare' ? active : undefined}
                onClick={() => {
                  if (a.id === 'more') onOpenAssumptions();
                  else if (a.id === 'risk') onOpenRisk();
                  else toggle(a.id);
                }}
                className={`min-h-12 rounded-full px-5 text-[15px] ${
                  a.primary
                    ? 'bg-ink font-semibold text-ground'
                    : active
                      ? 'border border-ink bg-raised'
                      : 'border border-line-strong bg-surface hover:border-ink-2'
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        {panel === 'afford' && affordability}
        {panel === 'markets' && portfolioComparison}
        {panel === 'compare' && savedScenarios}
      </section>
    </main>
  );
}
