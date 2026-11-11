import { useDeferredValue, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { breakEvenGrowth, runInvestmentProperty, type IpInputs, type IpResult, type IpYear } from '../utils/investmentProperty';
import { defaultInvestState, type InvestState } from '../utils/shareState';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { niceTicks, useChart, yearTicks } from './chartTheme';
import InvestAssumptions from './InvestAssumptions';
import InvestSentenceView, { type Lever } from './InvestSentenceView';
import Segmented from './Segmented';

const MONEY_FIELDS = [
  'propertyValue', 'loanBalance', 'rent', 'cashFlow', 'taxableRental', 'taxDifference', 'rentalTax', 'carriedLoss',
  'sharesValue', 'sideSharesValue', 'propertyNet', 'sharesNet', 'propertyCgt', 'sideSharesCgt', 'sharesCgt',
] as const;

/** A year's figures in today's dollars */
function deflate(y: IpYear, inflation: number): IpYear {
  const factor = Math.pow(1 + inflation / 100, y.year);
  const out = { ...y };
  for (const key of MONEY_FIELDS) out[key] = y[key] / factor;
  return out;
}

/** Property-minus-shares lead at `sell`, in the displayed dollar basis */
function leadAt(input: IpInputs, sell: number, realTerms: boolean): number {
  const y = runInvestmentProperty({ ...input, years: sell }).years.at(-1);
  if (!y) return 0;
  const lead = y.propertyNet - y.sharesNet;
  return realTerms ? lead / Math.pow(1 + input.inflation / 100, sell) : lead;
}

export interface InvestFigures {
  input: IpInputs;
  result: IpResult;
  /** Year-by-year figures in the displayed dollar basis */
  years: IpYear[];
  final: IpYear;
  sell: number;
  realTerms: boolean;
  breakEven: number | null;
  /** Property-minus-shares lead at the sell year: rows are growth −1/0/+1, columns share return −1/0/+1 */
  grid: number[][];
  otherKind: number;
  otherRules: number;
  /** Lead at each year with property growth a point lower and higher */
  band: { low: number; high: number }[];
  monthlyBefore: number;
  monthlyAfter: number;
  outOfPocket: number;
  rentCollected: number;
  sellingCosts: number;
}

const CGT_METHOD: Record<IpYear['cgtMethod'], string> = {
  discount: 'the 50% discount',
  indexation: 'indexation and the 30% minimum tax',
  split: 'the 50% discount to July 2027, then indexation',
};

export function InvestLedger({ f, onSellYearChange }: { f: InvestFigures; onSellYearChange: (year: number) => void }) {
  const { input, result, final, sell } = f;
  const isNew = input.kind === 'new';
  const Row = ({ label, property, shares, strong }: { label: string; property: number | null; shares: number | null; strong?: boolean }) => {
    const cell = (v: number | null) => (v === null ? <span className="text-muted">–</span> : formatCurrency(v));
    return (
      <tr className={strong ? 'border-t-2 border-line-strong' : ''}>
        <th scope="row" className={`px-3 text-left sm:px-4 ${strong ? 'py-3.5 text-base font-bold' : 'py-2 font-normal text-ink-2'}`}>{label}</th>
        <td className={`px-3 text-right font-mono sm:px-4 ${strong ? 'py-3.5 font-medium sm:text-lg' : 'py-2'}`}>{cell(property)}</td>
        <td className={`px-3 text-right font-mono sm:px-4 ${strong ? 'py-3.5 font-medium sm:text-lg' : 'py-2'}`}>{cell(shares)}</td>
      </tr>
    );
  };
  const other = (v: number) => (v > 0 ? `${formatCompactCurrency(v)} ahead of` : `${formatCompactCurrency(-v)} behind`);

  return (
    <section aria-label="Ledger" className="card overflow-x-auto p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4">
        <h2 className="m-0 text-base font-semibold">
          The books, if you sell after <span className="font-mono font-medium">{sell}</span> {sell === 1 ? 'year' : 'years'}
          {f.realTerms ? <span className="font-normal text-muted"> · today's dollars</span> : null}
        </h2>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <span className="sr-only">Sell after</span>
          <input type="range" min={1} max={input.years} value={sell} onChange={(e) => onSellYearChange(Number(e.target.value))}
            aria-valuetext={`${sell} years`} className="w-36 accent-[var(--color-ink)]" />
        </label>
      </div>
      <table className="w-full border-collapse text-[14px] sm:text-[15px] [&_td]:whitespace-nowrap">
        <thead>
          <tr>
            <th scope="col" className="px-3 py-3 text-left sm:px-4"><span className="sr-only">Item</span></th>
            <th scope="col" className="px-3 py-3 text-right text-sm font-semibold sm:px-4">
              <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-buy" />Property</span>
            </th>
            <th scope="col" className="px-3 py-3 text-right text-sm font-semibold sm:px-4">
              <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-rent" />Shares</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <Row label="Property value" property={final.propertyValue} shares={null} />
          <Row label="Loan repaid" property={-final.loanBalance} shares={null} />
          <Row label="Selling costs" property={-f.sellingCosts} shares={null} />
          <Row label="CGT on the property" property={-final.propertyCgt} shares={null} />
          <Row label="Shares" property={final.sideSharesValue} shares={final.sharesValue} />
          <Row label="CGT on shares" property={-final.sideSharesCgt} shares={-final.sharesCgt} />
          <Row label="Net worth" property={final.propertyNet} shares={final.sharesNet} strong />
        </tbody>
      </table>
      <ul className="m-0 flex list-none flex-col gap-1.5 border-t border-line px-4 py-4 text-[13px] leading-relaxed text-muted">
        <li>
          Both start with {formatCurrency(result.startingCash)}: the {formatCurrency(input.price * (1 - input.lvr / 100))} deposit,{' '}
          {formatCurrency(result.stampDuty)} stamp duty{isNew ? ' (on the land)' : ''} and {formatCurrency(input.purchaseCosts)} of costs.
        </li>
        <li>
          The landlord collects {formatCompactCurrency(f.rentCollected)} of rent and puts in {formatCompactCurrency(f.outOfPocket)} of their own money
          before tax; the shares investor invests the same amounts.
        </li>
        <li>Property CGT uses {CGT_METHOD[final.cgtMethod]}; both pay CGT as if selling in one year on top of their salary.</li>
        {final.carriedLoss > 1 && (
          <li>{formatCompactCurrency(final.carriedLoss)} of rental losses were quarantined, and are used against the property's gain at sale.</li>
        )}
        <li>
          The other choices: {isNew ? 'an established home' : 'a new build'} would finish {other(f.otherKind)} shares;
          under the {input.rules === 'reform' ? 'old' : 'new'} tax rules this one would be {other(f.otherRules).replace(' of', '')}.
        </li>
      </ul>
    </section>
  );
}

export function Sensitivity({ f }: { f: InvestFigures }) {
  const pct = (v: number) => `${v.toFixed(2).replace(/\.?0+$/, '')}%`;
  return (
    <section aria-label="Sensitivity" className="card flex flex-col gap-3 px-4 py-5 sm:px-6">
      <h2 className="m-0 text-base font-semibold">If the returns are a point off</h2>
      <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        Who finishes ahead after {f.sell} years, and by how much.
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-sm bg-buy" />Property</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-sm bg-rent" />Shares</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-2 text-left text-xs font-normal text-muted sm:px-3">Price growth ↓ Shares →</th>
              {[-1, 0, 1].map((d) => (
                <th key={d} scope="col" className="px-3 py-2 text-right font-mono text-xs font-medium text-ink-2">{pct(f.input.etfReturn + d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.grid.map((row, i) => (
              <tr key={i} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left font-mono text-xs font-medium text-ink-2">{pct(f.input.growth + i - 1)}</th>
                {row.map((v, j) => (
                  <td key={j} className={`px-2 py-2 text-right font-mono sm:px-3 ${i === 1 && j === 1 ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span aria-hidden className={`h-2 w-2 rounded-sm ${v > 0 ? 'bg-buy' : 'bg-rent'}`} />
                      <span className="sr-only">{v > 0 ? 'Property' : 'Shares'}</span> {formatCompactCurrency(Math.abs(v))}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LeavesOut({ lvr, open = false }: { lvr: number; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-surface px-5 py-4 sm:px-7">
      <summary className="cursor-pointer list-none text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        What this leaves out
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-ink-2 [&_p]:m-0">
        <p>
          <strong className="font-semibold text-ink">Risk.</strong> Both lines are smooth averages. A loan of {lvr}% means a{' '}
          {Math.round(100 - lvr)}% fall in price wipes out the deposit, and the result rides on one property in one suburb, where a
          share fund holds thousands of companies. Leverage magnifies both directions: a single point of growth moves the answer a
          long way.
        </p>
        <p>
          <strong className="font-semibold text-ink">Time and liquidity.</strong> Tenants, repairs and paperwork take time, and you can't sell a
          bathroom to cover an emergency. Shares sell in a day, in any amount.
        </p>
        <p>
          <strong className="font-semibold text-ink">Tax details.</strong> Income tax uses the 2027–28 rates, with brackets rising with
          inflation. Both sell in one year while still earning the salary, which pushes more of the gain into higher brackets than
          selling slowly in retirement would. The minimum tax exemption for pension recipients isn't modelled. New builds sold to a
          second owner lose negative gearing and the discount, which may weigh on their resale value; that isn't modelled either.
        </p>
        <p>
          <strong className="font-semibold text-ink">Costs.</strong> Land tax assumes this is your only investment land; a second
          property shares the threshold and pays much more. Mortgage insurance above 80% is a rough estimate. No rate rises, and
          no special levies or major repairs.
        </p>
        <p>
          <strong className="font-semibold text-ink">Sources.</strong> The 2027 rules are from the ATO and the Budget 2026–27 tax
          explainer on negative gearing and CGT; stamp duty uses each state's 2026–27 investor (general) rates. Each default says
          where it comes from in the source code.
        </p>
      </div>
    </details>
  );
}

function NetWorthChart({ f, onSellYearChange }: { f: InvestFigures; onSellYearChange: (year: number) => void }) {
  const { INK, SERIES, axisProps, gridProps, tooltipProps } = useChart();
  const data = f.years.map((y) => ({ year: y.year, property: y.propertyNet, shares: y.sharesNet }));
  const ticks = niceTicks(Math.min(0, ...data.flatMap((d) => [d.property, d.shares])), Math.max(...data.flatMap((d) => [d.property, d.shares])));
  return (
    <section aria-label="Net worth over time" className="card flex flex-col gap-3 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-base font-semibold">Net worth if you sold that year, after costs and tax</h2>
        <span className="flex items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-buy" />Property</span>
          <span className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-rent" />Shares</span>
        </span>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} className="cursor-crosshair"
            onClick={(state: { activeLabel?: number | string } | null) => {
              const year = Number(state?.activeLabel);
              if (Number.isFinite(year) && year >= 1) onSellYearChange(year);
            }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" {...axisProps} ticks={yearTicks(f.input.years).filter((y) => y > 0)} interval={0} />
            <YAxis {...axisProps} width={60} ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} tickFormatter={(v: number) => formatCompactCurrency(v)} />
            {f.sell < f.input.years && <ReferenceLine x={f.sell} stroke={INK.secondary} strokeDasharray="2 3" />}
            <Tooltip {...tooltipProps} labelFormatter={(y) => `Sell in year ${y}`} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
            <Line dataKey="property" name="Property" stroke={SERIES.buy} strokeWidth={3} dot={false} isAnimationActive={false} />
            <Line dataKey="shares" name="Shares" stroke={SERIES.rent} strokeWidth={3} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="m-0 text-xs text-muted">
        Click a year to sell then. Early years favour shares: stamp duty, purchase and selling costs come straight off the property side.
      </p>
    </section>
  );
}

/** The assumptions that move the answer most, shown up front in the Simple view */
const LEVERS: (Omit<Lever, 'options'> & { step: number })[] = [
  {
    field: 'growth',
    label: 'Price growth',
    step: 1,
    note: 'Long run, prices can only outgrow incomes (about 3–3.5% a year) while borrowing gets cheaper, and rates can’t fall from 17% to 3% again. See How house prices work.',
  },
  {
    field: 'rentGrowth',
    label: 'Rent increases',
    step: 1,
    note: 'Rent rises once a year. Over decades rents track incomes; the 2021–24 jumps of 5–10% a year were a catch-up, not a trend.',
  },
  {
    field: 'interestRate',
    label: 'Interest rate',
    step: 1,
    note: 'Investor loans cost more than owner-occupier loans. The rate is held flat for the whole period; a point higher for good is a rough stand-in for rate rises.',
  },
  {
    field: 'etfReturn',
    label: 'Share returns',
    step: 1,
    note: 'Total return before fees, a year: dividends plus price growth. The presets blend 30 years of history with Vanguard’s forward-looking model.',
  },
];

interface InvestCalculatorProps {
  state: InvestState;
  onChange: (next: InvestState) => void;
  view: 'simple' | 'ledger';
  onOpenLearn: () => void;
}

/** Investment property or shares: the second calculator, laid out like rent-or-buy (Simple and Ledger). */
export default function InvestCalculator({ state, onChange, view, onOpenLearn }: InvestCalculatorProps) {
  const { ip: input, realTerms } = state;
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [flash, setFlash] = useState<{ start: number; delta: number; at: number } | null>(null);
  const sell = Math.min(state.sellYear ?? input.years, input.years);

  /** Apply an edit and record how far it moved the result (edits within 2.5s add up) */
  const update = (next: InvestState) => {
    const nextSell = Math.min(next.sellYear ?? next.ip.years, next.ip.years);
    const now = Date.now();
    const start = flash && now - flash.at < 2500 ? flash.start : leadAt(input, sell, realTerms);
    setFlash({ start, delta: leadAt(next.ip, nextSell, next.realTerms) - start, at: now });
    onChange(next);
  };
  const set = (patch: Partial<IpInputs>) => update({ ...state, ip: { ...input, ...patch } });
  const setSell = (year: number) => onChange({ ...state, sellYear: year >= input.years ? null : year });
  const reset = () => update({ ...defaultInvestState(), realTerms });

  const deferred = useDeferredValue(input);
  const result = useMemo(() => runInvestmentProperty(input), [input]);
  const extras = useMemo(() => {
    const atSell = { ...deferred, years: sell };
    const lead = (patch: Partial<IpInputs>) => {
      const y = runInvestmentProperty({ ...atSell, ...patch }).years.at(-1)!;
      return y.propertyNet - y.sharesNet;
    };
    const leads = (growth: number) => runInvestmentProperty({ ...deferred, growth }).years.map((y) => y.propertyNet - y.sharesNet);
    return {
      breakEven: breakEvenGrowth(atSell),
      grid: [-1, 0, 1].map((dg) => [-1, 0, 1].map((de) => lead({ growth: atSell.growth + dg, etfReturn: atSell.etfReturn + de }))),
      otherKind: lead({ kind: deferred.kind === 'new' ? 'established' : 'new' }),
      otherRules: lead({ rules: deferred.rules === 'reform' ? 'old' : 'reform' }),
      low: leads(deferred.growth - 1),
      high: leads(deferred.growth + 1),
      levers: LEVERS.map((l) => ({
        ...l,
        options: [-2, -1, 0, 1, 2]
          .map((d) => +(deferred[l.field] + d * l.step).toFixed(2))
          .filter((v) => v >= 0)
          .map((value) => ({ value, lead: lead({ [l.field]: value }) })),
      })),
    };
  }, [deferred, sell]);

  const years = realTerms ? result.years.map((y) => deflate(y, input.inflation)) : result.years;
  const final = years.find((y) => y.year === sell) ?? years.at(-1);
  if (!final) return null;
  const toDisplay = (v: number, year: number) => (realTerms ? v / Math.pow(1 + input.inflation / 100, year) : v);
  const firstLet = result.years[Math.min(result.years.length - 1, Math.ceil((input.kind === 'new' ? input.buildMonths : 0) / 12))];
  const upToSell = years.filter((y) => y.year <= sell);
  const f: InvestFigures = {
    input,
    result,
    years,
    final,
    sell,
    realTerms,
    breakEven: extras.breakEven,
    grid: extras.grid.map((row) => row.map((v) => toDisplay(v, sell))),
    otherKind: toDisplay(extras.otherKind, sell),
    otherRules: toDisplay(extras.otherRules, sell),
    band: years.map((y, i) => ({ low: toDisplay(extras.low[i] ?? 0, y.year), high: toDisplay(extras.high[i] ?? 0, y.year) })),
    monthlyBefore: firstLet.cashFlow / 12,
    monthlyAfter: (firstLet.cashFlow - firstLet.rentalTax) / 12,
    outOfPocket: upToSell.reduce((sum, y) => sum + Math.max(0, -y.cashFlow), 0),
    rentCollected: upToSell.reduce((sum, y) => sum + y.rent, 0),
    sellingCosts: final.propertyValue * (input.sellingCosts / 100),
  };

  const dollarToggle = (
    <Segmented label="Dollar basis" value={realTerms} onChange={(value) => onChange({ ...state, realTerms: value })}
      options={[{ value: false, label: 'Future $' }, { value: true, label: "Today's $" }]} />
  );
  const panel = <InvestAssumptions input={input} onChange={set} onReset={reset} />;

  return (
    <>
      {view === 'simple' ? (
        <InvestSentenceView
          f={f}
          levers={extras.levers.map((l) => ({ ...l, options: l.options.map((o) => ({ ...o, lead: toDisplay(o.lead, sell) })) }))}
          flash={flash}
          onChange={set}
          onSellYearChange={setSell}
          onOpenAssumptions={() => setAssumptionsOpen(true)}
          onOpenLearn={onOpenLearn}
          ledger={<InvestLedger f={f} onSellYearChange={setSell} />}
          sensitivity={<Sensitivity f={f} />}
          leavesOut={<LeavesOut lvr={input.lvr} open />}
        />
      ) : (
        <div className="mx-auto grid max-w-[1360px] grid-cols-[minmax(0,1fr)] items-start gap-6 px-4 pt-6 pb-10 sm:px-6 lg:grid-cols-[minmax(340px,390px)_minmax(0,1fr)]">
          <div className="order-2 lg:sticky lg:top-6 lg:order-1 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:rounded-xl">{panel}</div>
          <main className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
            <div className="flex flex-wrap gap-2">{dollarToggle}</div>
            <InvestLedger f={f} onSellYearChange={setSell} />
            <NetWorthChart f={f} onSellYearChange={setSell} />
            <Sensitivity f={f} />
            <LeavesOut lvr={input.lvr} />
            <p className="m-0 max-w-3xl text-xs leading-relaxed text-muted">
              Both investors start with the same cash and spend the same each month. When the rental costs money after tax, the shares
              investor invests the same amount; when it pays, the landlord invests the surplus.{' '}
              <button type="button" onClick={onOpenLearn} className="underline underline-offset-2 hover:text-ink">How house prices work over the long run</button>
            </p>
          </main>
        </div>
      )}

      {view === 'ledger' && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 border-t border-line bg-ground/95 px-4 pt-3 pb-5 backdrop-blur lg:hidden">
          <button type="button" onClick={() => document.getElementById('assumptions')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-ink text-[15px] font-semibold text-ground">
            Edit assumptions
          </button>
        </div>
      )}

      {assumptionsOpen && view === 'simple' && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button type="button" aria-label="Close assumptions" onClick={() => setAssumptionsOpen(false)} className="absolute inset-0 bg-black/30" />
          <div role="dialog" aria-modal="true" aria-label="All assumptions"
            className="relative flex h-full w-full max-w-[420px] flex-col gap-3 overflow-y-auto bg-ground p-4 shadow-2xl"
            onKeyDown={(e) => e.key === 'Escape' && setAssumptionsOpen(false)}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-semibold">All assumptions</span>
              <button type="button" autoFocus onClick={() => setAssumptionsOpen(false)} className="min-h-10 rounded-lg border border-line px-3 text-sm text-ink-2 hover:text-ink">
                Done
              </button>
            </div>
            <div className="flex flex-wrap gap-2">{dollarToggle}</div>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}
