import type { ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import type { BreakEvenResult, MonteCarloResults, ScenarioResults, ScenarioValue, YearlySnapshot } from '../types';
import { encodeState, type SharedState } from '../utils/shareState';
import { calculateMortgagePayment, isScenarioValue, resolveScenarioValue, upfrontCostsOf } from '../utils/calculations';
import { explainGap } from '../utils/gap';
import { flipDistance, formatMetricValue } from '../utils/flip';
import { formatAdvantage, formatCompactCurrency, formatCurrency, formatPercent } from '../utils/format';
import { CITIES } from '../cities';
import { PORTFOLIOS } from '../portfolios';
import { PALETTES, niceTicks, yearTicks } from './chartTheme';
import { DISCLAIMER } from '../site';

// The printed report is always light, whatever the screen theme
const SERIES = PALETTES.light.SERIES;

interface PrintReportProps {
  state: SharedState;
  /** Baseline results in the displayed dollar basis */
  baseline: YearlySnapshot[];
  scenarios: ScenarioResults | null;
  sellYear: number;
  crossoverYear: number | null;
  breakEvens: BreakEvenResult[];
  /** Only a fresh (non-stale) run, already in the displayed dollar basis */
  monteCarlo: MonteCarloResults | null;
}

const INK = '#111827';
const MUTED = '#6b7280';
const RULE = '#d1d5db';

const advantage = (s: YearlySnapshot) => s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="print-section mt-6">
      <h2 className="m-0 mb-2 border-b pb-1 text-[12pt] font-semibold" style={{ borderColor: RULE }}>{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head?: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full border-collapse text-[9.5pt]">
      {head && (
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={`border-b py-1 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`} style={{ borderColor: RULE }}>{h}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i} className={`border-b py-1 ${i === 0 ? 'text-left' : 'text-right tabular-nums'}`} style={{ borderColor: '#eef0f3' }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: color, border: '1px solid #9ca3af' }} />;
}

const pct = (v: number | ScenarioValue) =>
  isScenarioValue(v) ? `${v.pessimistic}% / ${v.baseline}% / ${v.optimistic}%` : `${v}%`;

export default function PrintReport({ state, baseline, scenarios, sellYear, crossoverYear, breakEvens, monteCarlo }: PrintReportProps) {
  const { property: p, rent: r, investment: inv } = state;
  const deflator = state.realTerms ? Math.pow(1 + inv.inflationRate / 100, sellYear) : 1;
  const final = baseline[sellYear];
  const adv = advantage(final);
  const buyWins = adv < 0;
  const city = CITIES.find((c) => c.id === p.location);
  const portfolio = PORTFOLIOS.find((x) => x.id === inv.portfolio);
  const first = baseline[Math.min(1, baseline.length - 1)];

  const chartData = baseline.map((s, i) => ({
    year: s.year,
    base: advantage(s),
    pes: scenarios ? advantage(scenarios.pessimistic[i]) : undefined,
    opt: scenarios ? advantage(scenarios.optimistic[i]) : undefined,
  }));
  const scenarioAdvantages = scenarios
    ? [scenarios.pessimistic, scenarios.baseline, scenarios.optimistic].map((s) => advantage(s[sellYear]))
    : null;

  const drivers = [...explainGap(final, p, deflator)].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const offsetCash = final.mortgageNetPosition - final.mortgageEquity - final.mortgageInvestmentValue;
  const flips = breakEvens.filter((b) => b.breakEvenValue !== null).sort((a, b) => flipDistance(a) - flipDistance(b));

  const loan = Math.max(0, p.propertyPrice - p.deposit + (p.lmi ?? 0));
  const rate = resolveScenarioValue(p.interestRate, 'baseline');
  const repayment = calculateMortgagePayment(loan, rate, p.loanTerm);
  const testRepayment = calculateMortgagePayment(loan, rate + 3, p.loanTerm);

  const assumptions: [string, string][] = [
    ['Location', city ? city.name : 'Custom'],
    ['Purchase price', formatCurrency(p.propertyPrice)],
    ['Deposit', `${formatCurrency(p.deposit)} (LVR ${(((p.propertyPrice - p.deposit) / p.propertyPrice) * 100).toFixed(1)}%)`],
    ['LMI', formatCurrency(p.lmi ?? 0)],
    ['Interest rate', pct(p.interestRate)],
    ['Loan term', `${p.loanTerm} years`],
    ['Offset balance', formatCurrency(p.offsetAccountBalance ?? 0)],
    ['Stamp duty', `${formatCurrency(p.stampDuty)} (${p.state ? `${p.state}, ${p.firstHomeBuyer ? 'first home buyer' : 'owned before'}, ${p.newHome ? 'new' : 'established'} home` : 'entered manually'})`],
    ['First home owner grant', formatCurrency(p.firstHomeGrant ?? 0)],
    ['Other purchase costs', formatCurrency(p.otherPurchaseCosts)],
    ['Maintenance', `${p.maintenanceRate}% of value / yr`],
    ['Council & water', `${formatCurrency(p.councilRates)} / yr`],
    ['Building insurance', `${formatCurrency(p.buildingInsurance)} / yr`],
    ['Contents insurance (own / rent)', `${formatCurrency(p.contentsInsurance)} / ${formatCurrency(r.contentsInsurance)}`],
    ['Selling costs', `${p.sellingCostRate}%`],
    ['CGT on home', `${p.capitalGainsTaxRate}%`],
    ['Rent', `${formatCurrency(r.monthlyRent)} / month`],
    ['Rent growth', pct(r.rentIncreaseRate)],
    ['Moving', `Every ${r.movingFrequency} yrs, ${formatCurrency(r.movingCost)} each`],
    ['Portfolio', portfolio ? `${portfolio.name} (${portfolio.example})` : 'Custom'],
    ['Total return', pct(inv.stockMarketReturn)],
    ['Dividend yield / franked', `${inv.dividendYield ?? 0}% / ${inv.frankingLevel ?? 0}%`],
    ['Fund fee / brokerage', `${inv.managementFee ?? 0}% / ${inv.stockTransactionCost}%`],
    ['Property growth', pct(inv.propertyGrowthRate)],
    ['Tax rate (incl. Medicare)', `${inv.marginalTaxRate}%`],
    ['Inflation', `${inv.inflationRate}%`],
    ['Horizon / sell after', `${state.horizon} / ${sellYear} years`],
    ['Dollar basis', state.realTerms ? "Today's dollars" : 'Future dollars'],
  ];
  const half = Math.ceil(assumptions.length / 2);
  // Built from state rather than location.href, which may not carry the hash yet
  const shareLink = `${window.location.origin}${window.location.pathname}#${encodeState(state)}`;
  const values = chartData.flatMap((d) => [d.base, d.pes, d.opt]).filter((v): v is number => v !== undefined);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));

  return (
    <article className="print-report text-[10.5pt] leading-snug" style={{ color: INK, fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <header className="flex items-end justify-between border-b-2 pb-2" style={{ borderColor: INK }}>
        <div>
          <h1 className="m-0 text-[18pt] font-bold tracking-tight">Rent or Buy — scenario report</h1>
          <p className="m-0 mt-0.5 text-[9.5pt]" style={{ color: MUTED }}>
            {city ? city.name : 'Custom location'} · {portfolio ? portfolio.name : 'Custom portfolio'} ·{' '}
            {state.realTerms ? "today's dollars" : 'future dollars'}
          </p>
        </div>
        <p className="m-0 text-[9.5pt]" style={{ color: MUTED }}>
          Generated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </header>

      <section className="print-section mt-5">
        <p className="m-0 text-[9.5pt] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
          If you sell after {sellYear} years · baseline
        </p>
        <p className="m-0 mt-1 text-[16pt] font-bold">
          {buyWins ? 'Buying' : 'Renting and investing'} comes out ahead by {formatCurrency(Math.abs(adv))}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-6">
          <div>
            <div className="text-[9.5pt]" style={{ color: MUTED }}><Swatch color={SERIES.buy} />Buy · net worth after selling</div>
            <div className="text-[14pt] font-semibold tabular-nums">{formatCurrency(final.mortgageNetPositionAfterSale)}</div>
          </div>
          <div>
            <div className="text-[9.5pt]" style={{ color: MUTED }}><Swatch color={SERIES.rent} />Rent + invest · net worth after CGT</div>
            <div className="text-[14pt] font-semibold tabular-nums">{formatCurrency(final.rentNetPositionAfterTax)}</div>
          </div>
        </div>
        <ul className="m-0 mt-3 list-disc pl-5 text-[10pt]">
          <li>
            Year 1 housing cost: {formatCurrency(first.mortgageAnnualCost / 12)}/month to own vs{' '}
            {formatCurrency(first.rentAnnualCost / 12)}/month to rent; the cheaper option invests the difference.
          </li>
          <li>
            {crossoverYear === null
              ? `Buying does not stay ahead within ${state.horizon} years.`
              : `Buying takes the lead in year ${crossoverYear} and keeps it.`}
          </li>
          {scenarioAdvantages && (
            <li>
              Across 3 scenarios: {scenarioAdvantages.filter((a) => a < 0).length} of 3 favour buying, ranging{' '}
              {formatAdvantage(Math.min(...scenarioAdvantages))} to {formatAdvantage(Math.max(...scenarioAdvantages))}.
            </li>
          )}
        </ul>
      </section>

      <Section title="Who is ahead, by the year you sell">
        <LineChart width={680} height={240} data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="year" ticks={yearTicks(state.horizon)} interval={0} tick={{ fill: MUTED, fontSize: 10 }} stroke={RULE} tickLine={false} />
          <YAxis width={60} domain={[ticks[0], ticks[ticks.length - 1]]} ticks={ticks} tick={{ fill: MUTED, fontSize: 10 }} stroke={RULE} tickLine={false} tickFormatter={(v: number) => formatCompactCurrency(v)} />
          <ReferenceLine y={0} stroke={INK} strokeWidth={1} />
          {sellYear < state.horizon && <ReferenceLine x={sellYear} stroke={MUTED} strokeDasharray="2 3" />}
          {scenarios && <Line dataKey="pes" stroke={MUTED} strokeWidth={1.25} strokeDasharray="6 4" dot={false} isAnimationActive={false} />}
          {scenarios && <Line dataKey="opt" stroke={MUTED} strokeWidth={1.25} strokeDasharray="1 3" dot={false} isAnimationActive={false} />}
          <Line dataKey="base" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
        <p className="m-0 mt-1 text-[9pt]" style={{ color: MUTED }}>
          Above zero renting is ahead; below zero buying is ahead. Solid: baseline
          {scenarios ? '; dashed: pessimistic; dotted: optimistic' : ''}.
        </p>
      </Section>

      <Section title={`Why ${buyWins ? 'buying' : 'renting'} comes out ahead after ${sellYear} years`}>
        <Table
          head={['Driver', 'Effect']}
          rows={[
            ...drivers.map((d) => [d.label, Math.abs(d.amount) < 500 ? '≈ $0' : `${d.amount > 0 ? 'Buy' : 'Rent'} +${formatCompactCurrency(Math.abs(d.amount))}`]),
            [<strong key="n">Net result</strong>, <strong key="v">{formatAdvantage(adv)}</strong>],
          ]}
        />
      </Section>

      <Section title="Where the money ends up">
        <Table
          head={[`${sellYear} years`, <span key="b"><Swatch color={SERIES.buy} />Buy</span>, <span key="r"><Swatch color={SERIES.rent} />Rent</span>]}
          rows={[
            ['Home value', formatCurrency(final.mortgagePropertyValue), '–'],
            ...(final.mortgageLoanBalance > 1 ? [['Loan still owed', formatCurrency(-final.mortgageLoanBalance), '–']] : []),
            ['Shares', formatCurrency(final.mortgageInvestmentValue), formatCurrency(final.rentInvestmentValue)],
            ...(Math.abs(offsetCash) > 1 ? [['Offset cash', formatCurrency(offsetCash), '–']] : []),
            ['Selling costs and tax', formatCurrency(final.mortgageNetPositionAfterSale - final.mortgageNetPosition), formatCurrency(final.rentNetPositionAfterTax - final.rentNetPosition)],
            [<strong key="n">Net worth</strong>, <strong key="b">{formatCurrency(final.mortgageNetPositionAfterSale)}</strong>, <strong key="r">{formatCurrency(final.rentNetPositionAfterTax)}</strong>],
          ]}
        />
      </Section>

      {flips.length > 0 && (
        <Section title={`What would flip it to ${buyWins ? 'renting' : 'buying'}`}>
          <Table
            head={['Assumption', 'Now', 'Flips at', 'Change']}
            rows={flips.map((b) => [
              b.metric,
              formatMetricValue(b, b.currentValue),
              formatMetricValue(b, b.breakEvenValue!),
              `${Math.round(flipDistance(b) * 100)}%`,
            ])}
          />
        </Section>
      )}

      {state.income !== null && state.income > 0 && (
        <Section title="Affordability">
          <Table
            rows={[
              ['Cash needed upfront (deposit, stamp duty, costs, less any grant)', formatCurrency(p.deposit + upfrontCostsOf(p))],
              [`Repayments at ${rate}%`, `${formatCurrency(repayment)}/month · ${formatPercent((repayment * 12) / state.income)} of income`],
              [`Repayments at the bank's test rate (${(rate + 3).toFixed(2)}%)`, `${formatCurrency(testRepayment)}/month · ${formatPercent((testRepayment * 12) / state.income)} of income`],
              ['Loan vs household income', `${(loan / state.income).toFixed(1)}× (APRA restricts 6× or more)`],
            ]}
          />
        </Section>
      )}

      {monteCarlo && (
        <Section title={`Risk: ${monteCarlo.iterations.toLocaleString('en-AU')} simulated futures`}>
          <Table
            rows={[
              ['Chance buying leaves you better off', formatPercent(monteCarlo.buyBetterProbability)],
              ['Typical outcome (median)', formatAdvantage(monteCarlo.percentiles.p50)],
              ['Average outcome', formatAdvantage(monteCarlo.expectedAdvantage)],
              ['Middle 80% of futures', `${formatAdvantage(monteCarlo.percentiles.p10)} to ${formatAdvantage(monteCarlo.percentiles.p90)}`],
            ]}
          />
          <p className="m-0 mt-1 text-[9pt]" style={{ color: MUTED }}>Outcomes after {state.horizon} years.</p>
        </Section>
      )}

      <Section title="Assumptions">
        <div className="grid grid-cols-2 gap-6">
          <Table rows={assumptions.slice(0, half).map(([k, v]) => [k, v])} />
          <Table rows={assumptions.slice(half).map(([k, v]) => [k, v])} />
        </div>
        {isScenarioValue(p.interestRate) && (
          <p className="m-0 mt-1 text-[9pt]" style={{ color: MUTED }}>Three values read pessimistic / baseline / optimistic.</p>
        )}
      </Section>

      <footer className="print-section mt-6 border-t pt-2 text-[8.5pt]" style={{ borderColor: RULE, color: MUTED }}>
        {/* The full link is ~1,000 characters; a short clickable label keeps it off its own page */}
        <p className="m-0">
          <a href={shareLink} style={{ color: INK }}>Open this scenario online</a>
          {' '}(the link in this PDF restores every assumption).
        </p>
        <p className="m-0 mt-1">
          Both households start with the same savings and spend the same each month; the cheaper option invests the
          difference. {DISCLAIMER}
        </p>
      </footer>
    </article>
  );
}
