import { useState, type ReactNode } from 'react';
import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { IpInputs } from '../utils/investmentProperty';
import { stampDutyFor } from '../utils/investmentProperty';
import { AU_STATES, STAMP_DUTY_RULES } from '../utils/stampDuty';
import { IP_SHARE_PRESETS, ipPortfolio, ipPortfolioFields } from '../utils/shareState';
import { PORTFOLIO_PHRASES } from '../utils/narrative';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { AdornedInput } from './InputField';
import SentencePill from './SentencePill';
import { niceTicks, useChart, yearTicks } from './chartTheme';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { InvestFigures } from './InvestCalculator';

/** One of the assumptions that decides the answer, with the outcome at nearby values */
export interface Lever {
  field: 'growth' | 'rentGrowth' | 'interestRate' | 'etfReturn';
  label: string;
  note: string;
  options: { value: number; lead: number }[];
}

function ChoiceList<T extends string>({ options, value, onPick }: {
  options: { value: T; label: string; detail?: string }[];
  value: T | undefined;
  onPick: (value: T) => void;
}) {
  return (
    <span className="flex max-h-72 flex-col gap-1 overflow-y-auto">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onPick(o.value)} aria-pressed={o.value === value}
          className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-left text-sm ${o.value === value ? 'bg-raised font-semibold' : 'hover:bg-raised'}`}>
          <span>{o.label}</span>
          {o.detail && <span className="font-mono text-xs text-muted">{o.detail}</span>}
        </button>
      ))}
    </span>
  );
}

const pct = (v: number) => `${+v.toFixed(2)}%`;
/** "$1.39m" in monospace, with the point pulled in so it doesn't read as "$1 . 39m" */
const tight = (text: string) =>
  text.split(/([.,])/).map((part, i) => (part === '.' || part === ',' ? <span key={i} className="-mx-[0.14em]">{part}</span> : part));

interface Props {
  f: InvestFigures;
  levers: Lever[];
  flash: { delta: number; at: number } | null;
  onChange: (patch: Partial<IpInputs>) => void;
  onSellYearChange: (year: number) => void;
  onOpenAssumptions: () => void;
  onOpenLearn: () => void;
  ledger: ReactNode;
  sensitivity: ReactNode;
  leavesOut: ReactNode;
}

type Panel = 'books' | 'sensitivity' | 'leaves' | null;

export default function InvestSentenceView({ f, levers, flash, onChange, onSellYearChange, onOpenAssumptions, onOpenLearn, ledger, sensitivity, leavesOut }: Props) {
  const { INK, SERIES, axisProps, tooltipProps } = useChart();
  const wide = useMediaQuery('(min-width: 640px)');
  const [panel, setPanel] = useState<Panel>(null);
  const [leverIndex, setLeverIndex] = useState(0);
  const { input, final, sell, years } = f;
  const isNew = input.kind === 'new';
  const lead = final.propertyNet - final.sharesNet;
  const scale = Math.max(Math.abs(final.propertyNet), Math.abs(final.sharesNet), 1);
  const winner = Math.abs(lead) < scale * 0.01 ? 'even' : lead > 0 ? 'property' : 'shares';
  const deposit = input.price * (1 - input.lvr / 100);
  const portfolio = ipPortfolio(input);

  // Shares-minus-property, so shares sit above the line as renting does in rent-or-buy
  const data = years.map((y, i) => {
    const base = y.sharesNet - y.propertyNet;
    const range = [-f.band[i].low, -f.band[i].high, base];
    return { year: y.year, base, range: [Math.min(...range), Math.max(...range)] as [number, number] };
  });
  const ticks = niceTicks(Math.min(0, ...data.flatMap((d) => d.range)), Math.max(0, ...data.flatMap((d) => d.range)));

  // When the property first pulls ahead for good
  const aheadFrom = (() => {
    let from: number | null = null;
    for (const y of years) {
      if (y.year > sell) break;
      if (y.propertyNet > y.sharesNet) from ??= y.year;
      else from = null;
    }
    return from;
  })();

  const sentence = (
    <div className="m-0 max-w-[980px] text-[22px] leading-[1.65] font-medium tracking-tight text-ink-2 sm:text-[32px] sm:leading-[1.55]">
      I could buy a{' '}
      <SentencePill label={formatCurrency(input.price)} title="Purchase price">
        {() => (
          <span className="flex flex-col gap-2">
            <AdornedInput ariaLabel="Purchase price" format="currency" value={input.price} onChange={(price) => onChange({ price })} />
            <span className="text-xs text-muted">
              Stamp duty {formatCurrency(f.result.stampDuty)}{isNew ? ', on the land only' : ''}, at {input.state} investor rates.
            </span>
          </span>
        )}
      </SentencePill>{' '}
      <SentencePill label={isNew ? 'new build' : 'established home'} title="Property type">
        {(close) => (
          <span className="flex flex-col gap-2">
            <ChoiceList
              value={input.kind}
              options={[
                { value: 'new', label: 'New build', detail: 'negatively gearable' },
                { value: 'established', label: 'Established home', detail: 'losses quarantined' },
              ]}
              onPick={(kind) => { onChange({ kind }); close(); }}
            />
            <span className="max-w-72 text-xs leading-snug text-muted">
              From July 2027 only new builds can deduct rental losses from your salary. A new build's value grows a point slower for
              its first 10 years, as it does in rent-or-buy: buyers pay a premium for new, and buildings wear out.
            </span>
          </span>
        )}
      </SentencePill>{' '}
      to rent out in{' '}
      <SentencePill label={STAMP_DUTY_RULES[input.state].name} title="State">
        {(close) => (
          <ChoiceList
            value={input.state}
            options={AU_STATES.map((s) => ({ value: s, label: STAMP_DUTY_RULES[s].name, detail: `${formatCompactCurrency(stampDutyFor({ ...input, state: s }))} duty` }))}
            onPick={(state) => { onChange({ state }); close(); }}
          />
        )}
      </SentencePill>{' '}
      with{' '}
      <SentencePill label={formatCurrency(deposit)} title="Deposit">
        {() => (
          <span className="flex flex-col gap-2">
            <AdornedInput ariaLabel="Deposit" format="currency" value={Math.round(deposit)}
              onChange={(d) => onChange({ lvr: input.price > 0 ? Math.max(0, Math.min(100, +(100 - (d / input.price) * 100).toFixed(2))) : 0 })} />
            <span className="text-xs text-muted">{Math.round(100 - input.lvr)}% of the price, plus stamp duty and costs.</span>
          </span>
        )}
      </SentencePill>{' '}
      down, or put the same money into{' '}
      <SentencePill label={(portfolio && PORTFOLIO_PHRASES[portfolio.id]) ?? 'my own mix'} title="Shares">
        {(close) => (
          <ChoiceList
            value={portfolio?.id}
            options={IP_SHARE_PRESETS.map((p) => ({ value: p.id, label: p.name, detail: `${p.returns.baseline}%` }))}
            onPick={(id) => {
              const preset = IP_SHARE_PRESETS.find((p) => p.id === id);
              if (preset) onChange(ipPortfolioFields(preset));
              close();
            }}
          />
        )}
      </SentencePill>. I earn{' '}
      <SentencePill label={formatCurrency(input.salary)} title="Salary before tax">
        {() => (
          <span className="flex flex-col gap-2">
            <AdornedInput ariaLabel="Salary before tax" format="currency" value={input.salary} onChange={(salary) => onChange({ salary })} />
            <span className="text-xs text-muted">Before tax. It sets the rate rental losses are deducted at, and the tax on gains.</span>
          </span>
        )}
      </SentencePill>{' '}
      a year. If I sell after{' '}
      <span className="whitespace-nowrap">
        <SentencePill label={`${sell} ${sell === 1 ? 'year' : 'years'}`} title="Sell after">
          {() => (
            <span className="flex flex-col gap-3">
              <input type="range" min={1} max={input.years} value={sell} onChange={(e) => onSellYearChange(Number(e.target.value))}
                aria-label="Years until you sell" aria-valuetext={`${sell} years`} className="w-full accent-[var(--color-ink)]" />
              <span className="font-mono text-sm">{sell} of {input.years} years</span>
            </span>
          )}
        </SentencePill>,
      </span>{' '}
      which leaves me better off?
    </div>
  );

  const lever = levers[leverIndex];
  const cards = whyCards(f, winner);
  const toggle = (next: Panel) => setPanel(panel === next ? null : next);

  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-14 px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <section aria-label="Your situation" className="flex flex-col gap-4">
        {sentence}
        <p className="m-0 text-sm text-muted">
          Tap any underlined value to change it. A {input.interestRate}% loan, interest-only for {input.ioYears} years
          {input.ioYears > 0 ? ' then principal and interest' : ''}; rent starts at {pct(input.grossYield)} of the value. The
          rules are {input.rules === 'reform' ? 'the negative gearing and CGT changes that start in July 2027' : 'the old ones, for comparison'}.
          The rest are under{' '}
          <button type="button" onClick={onOpenAssumptions} className="underline underline-offset-4 hover:text-ink">More assumptions</button>.
        </p>
      </section>

      <section aria-label="Answer" aria-live="polite" className="flex flex-col gap-5">
        <h1 className="m-0 text-5xl leading-none font-bold tracking-tighter sm:text-7xl">
          {winner === 'even' ? 'About even.' : (
            <>
              {winner === 'property' ? 'The property' : 'Shares'}, by{' '}
              <span className={`font-mono font-medium ${winner === 'property' ? 'text-buy' : 'text-rent'}`}>{tight(formatCompactCurrency(Math.abs(lead)))}</span>.
            </>
          )}
        </h1>
        <p className="m-0 max-w-3xl text-lg leading-relaxed text-ink-2 sm:text-xl">
          {aheadFrom === null
            ? `Shares stay ahead for all ${sell} years.`
            : aheadFrom === 1 ? 'The property is ahead from the first year.'
            : `Shares lead for the first ${aheadFrom - 1} ${aheadFrom === 2 ? 'year' : 'years'} while the property pays off its stamp duty and costs.`}{' '}
          {f.breakEven === null
            ? 'No price growth between −2% and 12% a year changes the winner.'
            : <>It needs prices to grow <strong className="font-semibold text-ink">{f.breakEven.toFixed(1)}%</strong> a year to draw level; you assumed {pct(input.growth)}.</>}
        </p>
        <div className="min-h-7">
          {flash && Math.abs(flash.delta) >= 500 && (
            <span key={flash.at} className="change-flash inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-[13px]">
              <span aria-hidden className={`h-2 w-2 rounded-full ${flash.delta > 0 ? 'bg-buy' : 'bg-rent'}`} />
              Your change moved it <span className="font-mono">{formatCompactCurrency(Math.abs(flash.delta))}</span> toward{' '}
              {flash.delta > 0 ? 'the property' : 'shares'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          {[
            { label: 'Shares', value: final.sharesNet, swatch: 'bg-rent' },
            { label: 'Investment property', value: final.propertyNet, swatch: 'bg-buy' },
          ].map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm text-muted"><span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${row.swatch}`} />{row.label}</span>
              <span className="font-mono text-2xl sm:text-3xl">{formatCurrency(row.value)}</span>
            </div>
          ))}
          <span className="pb-1.5 text-sm text-muted">
            Net worth after selling everything and paying tax{f.realTerms ? ", in today's dollars" : ''}
          </span>
        </div>
        <p className="m-0 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          {f.monthlyBefore < 0
            ? <>Once it's let, the property costs about <strong className="font-semibold text-ink">{formatCurrency(-f.monthlyBefore)} a month</strong> before tax
                {f.monthlyAfter < 0 ? <> and {formatCurrency(-f.monthlyAfter)} after</> : <>, and nothing after tax</>}. The shares investor invests the same amount each month.</>
            : <>Once it's let, the property pays about {formatCurrency(f.monthlyBefore)} a month before tax, which goes into shares.</>}
        </p>

        {lever && (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-base font-semibold">What decides it</h2>
              <p className="m-0 max-w-3xl text-sm leading-snug text-muted">
                Four assumptions move the answer most. Pick one to see who wins at nearby values, and tap a value to use it.
              </p>
            </div>
            <div role="tablist" aria-label="Assumption" className="flex flex-wrap gap-1.5">
              {levers.map((l, i) => (
                <button key={l.field} type="button" role="tab" aria-selected={i === leverIndex} onClick={() => setLeverIndex(i)}
                  className={`min-h-9 rounded-full px-3.5 text-sm ${i === leverIndex ? 'bg-ink font-semibold text-ground' : 'border border-line text-ink-2 hover:border-ink-2 hover:text-ink'}`}>
                  {l.label}
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label={lever.label} className="grid grid-cols-5 gap-1.5">
              {lever.options.map((o) => {
                const selected = Math.abs(o.value - input[lever.field]) < 1e-9;
                const side = Math.abs(o.lead) < scale * 0.01 ? 'even' : o.lead > 0 ? 'property' : 'shares';
                return (
                  <button key={o.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange({ [lever.field]: o.value })}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-center ${selected ? 'border border-ink bg-raised' : 'border border-line hover:border-ink-2'}`}>
                    <span className={`font-mono text-sm ${selected ? 'font-semibold' : ''}`}>{pct(o.value)}</span>
                    <span className={`font-mono text-[11px] sm:text-xs ${side === 'property' ? 'text-buy' : side === 'shares' ? 'text-rent' : 'text-muted'}`}>
                      {side === 'even' ? 'Even' : `${side === 'property' ? 'Prop.' : 'Shares'} ${formatCompactCurrency(Math.abs(o.lead))}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="m-0 max-w-3xl text-xs leading-snug text-muted">{lever.note}</p>
          </div>
        )}
      </section>

      <section aria-label="If you sold earlier" className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-xl font-semibold">If you sold earlier</h2>
          <span className="text-sm text-muted">Shaded: prices growing a point slower or faster. Click a year to sell then.</span>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: wide ? 24 : 8, bottom: 4, left: 4 }} className="cursor-crosshair"
              onClick={(state: { activeLabel?: number | string } | null) => {
                const year = Number(state?.activeLabel);
                if (Number.isFinite(year) && year >= 1) onSellYearChange(year);
              }}>
              <ReferenceArea y1={0} y2={ticks[ticks.length - 1]} fill={SERIES.rent} fillOpacity={0.06} ifOverflow="extendDomain"
                label={{ value: 'Shares ahead ↑', position: 'insideTopLeft', fill: INK.secondary, fontSize: 13, fontWeight: 600 }} />
              <ReferenceArea y1={ticks[0]} y2={0} fill={SERIES.buy} fillOpacity={0.06} ifOverflow="extendDomain"
                label={{ value: 'Property ahead ↓', position: 'insideBottomLeft', fill: INK.secondary, fontSize: 13, fontWeight: 600 }} />
              <XAxis dataKey="year" {...axisProps} ticks={yearTicks(input.years).filter((y) => y > 0)} interval={0}
                tickFormatter={(y: number) => (wide ? `Yr ${y}` : String(y))} />
              <YAxis {...axisProps} width={60} domain={[ticks[0], ticks[ticks.length - 1]]} ticks={ticks}
                tickFormatter={(v: number) => (v === 0 ? 'Even' : formatCompactCurrency(Math.abs(v)))} />
              <ReferenceLine y={0} stroke={INK.muted} />
              {sell < input.years && <ReferenceLine x={sell} stroke={INK.secondary} strokeDasharray="2 3" />}
              <Tooltip {...tooltipProps} labelFormatter={(y) => `Sell in year ${y}`}
                formatter={(value: number | number[], name: string) => {
                  const say = (v: number) => `${v > 0 ? 'Shares' : 'Property'} +${formatCompactCurrency(Math.abs(v))}`;
                  return Array.isArray(value) ? [`${say(value[0])} to ${say(value[1])}`, 'Range'] : [say(value), name];
                }} />
              <Area dataKey="range" stroke="none" fill={INK.primary} fillOpacity={0.08} isAnimationActive={false} name="Range" />
              <Line dataKey="base" name="Your assumptions" stroke={INK.primary} strokeWidth={3} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section aria-label="Why" className="flex flex-col gap-5">
        <h2 className="m-0 text-2xl font-bold tracking-tight sm:text-[28px]">
          {winner === 'even' ? 'Why it is so close' : `Why ${winner === 'property' ? 'the property' : 'shares'} ${winner === 'property' ? 'wins' : 'win'} here`}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <div key={card.text} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-5 py-5">
              <span className="font-mono text-2xl">{card.figure}</span>
              <span className="text-[15px] leading-snug text-ink-2">{card.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Go further" className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-semibold">Where do house prices come from?</h2>
            <p className="m-0 max-w-xl text-[15px] leading-snug text-ink-2">
              The answer rides on price growth. See what has driven it for 35 years, why that can't simply repeat, and how housing
              compares with shares over the very long run.
            </p>
          </div>
          <button type="button" onClick={onOpenLearn} className="min-h-12 shrink-0 self-start rounded-full bg-ink px-6 text-[15px] font-semibold text-ground sm:self-center">
            How house prices work
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className="mr-1 text-sm text-muted">Or:</span>
          {([
            { id: 'books', label: 'Show the books' },
            { id: 'sensitivity', label: 'If returns are a point off' },
            { id: 'leaves', label: 'What this leaves out' },
          ] as const).map((a) => (
            <button key={a.id} type="button" aria-expanded={panel === a.id} onClick={() => toggle(a.id)}
              className={`min-h-11 rounded-full px-4 text-[15px] ${panel === a.id ? 'border border-ink bg-raised' : 'border border-line text-ink-2 hover:border-ink-2 hover:text-ink'}`}>
              {a.label}
            </button>
          ))}
          <button type="button" onClick={onOpenAssumptions}
            className="min-h-11 rounded-full border border-line px-4 text-[15px] text-ink-2 hover:border-ink-2 hover:text-ink">
            All assumptions
          </button>
        </div>
        {panel === 'books' && ledger}
        {panel === 'sensitivity' && sensitivity}
        {panel === 'leaves' && leavesOut}
      </section>
    </main>
  );
}

/** Three plain-language reasons for the result, each with a headline figure */
function whyCards(f: InvestFigures, winner: 'property' | 'shares' | 'even') {
  const { input, result, sell, years } = f;
  const upToSell = years.filter((y) => y.year <= sell);
  const taxSaved = -upToSell.reduce((sum, y) => sum + Math.min(0, y.rentalTax), 0);
  const peakCarried = Math.max(0, ...upToSell.map((y) => y.carriedLoss));
  const frictions = result.stampDuty + input.purchaseCosts + f.sellingCosts;
  const cards: { figure: string; text: string }[] = [];

  const leverage = {
    figure: formatCompactCurrency(result.loan),
    text: `borrowed, so the property grows on its whole ${formatCompactCurrency(input.price)} value while shares grow on the ${formatCompactCurrency(result.startingCash)} you start with.`,
  };
  const costs = {
    figure: formatCompactCurrency(frictions),
    text: `in stamp duty, purchase and selling costs. Shares cost next to nothing to buy and sell.`,
  };
  const tax = peakCarried > 1
    ? { figure: formatCompactCurrency(peakCarried), text: 'of rental losses that can’t reduce tax on your salary. They wait to be used against the sale.' }
    : taxSaved > 1
      ? { figure: formatCompactCurrency(taxSaved), text: `less income tax over ${sell} years, from deducting the property’s losses and depreciation from your salary.` }
      : null;
  const outOfPocket = {
    figure: formatCompactCurrency(f.outOfPocket),
    text: `of your own money put into the property over ${sell} years before tax. The shares investor invests the same.`,
  };
  const growth = f.breakEven === null ? null : {
    figure: `${+input.growth.toFixed(2)}% vs ${f.breakEven.toFixed(1)}%`,
    text: 'price growth assumed, against what the property needs to draw level with shares.',
  };

  if (winner === 'property') cards.push(leverage);
  else cards.push(costs);
  if (tax) cards.push(tax);
  if (growth) cards.push(growth);
  if (cards.length < 3) cards.push(winner === 'property' ? costs : outOfPocket);
  if (cards.length < 3) cards.push(leverage);
  return cards.slice(0, 3);
}
