import { useState, type ReactNode } from 'react';
import { formatCurrency } from '../utils/format';
import type { Source } from './SourcesModal';

// Figures quoted here, and where they come from (read 7 Nov 2026):
// - Cotality, Housing Affordability Report, Nov 2025: dwelling values 8.2× median household
//   income (Sep 2025), a series high; 20-year average 6.8.
// - RBA Bulletin, Sep 2015, "Long-run Trends in Housing Price Growth": real price growth ~1.4%
//   a year in the 1980s, ~4.5% from 1990 to the mid-2000s, ~2.5% in the decade to 2015;
//   deregulation and the shift to low inflation were one-off; the household debt-to-income
//   ratio rose, then steadied around 150%. Their model found income per head insignificant
//   over their sample, while noting other studies find it drives prices over very long periods.
// - RBA Annual Report 1990: bank housing rates held at 17% from 1989 into 1990.
// - Knoll, Schularick & Steger, "No Price Like Home" (AER 2017): real house prices in 14
//   advanced economies roughly tripled since 1900, nearly all after 1950; rising land prices
//   explain about 80% of the post-war increase.
// - Eichholtz, "A Long Run House Price Index: The Herengracht Index, 1628–1973" (Real Estate
//   Economics 1997): real values in 1973 only about twice their 1628 level.
// - Jordà, Knoll, Kuvshinov, Schularick & Taylor, "The Rate of Return on Everything, 1870–2015"
//   (QJE 2019; FRBSF WP 2017-25): housing and equities both returned about 7% a year after
//   inflation; housing about half as volatile; housing returns are mostly rent and are
//   estimated for national indices, before transaction costs and taxes.
// - APRA serviceability buffer: lenders test borrowers at 3 points above the loan rate (since
//   Oct 2021).

const SOURCES: Source[] = [
  {
    title: 'Australia’s housing affordability hits new lows',
    publisher: 'Cotality, November 2025',
    detail: 'Dwelling values are a record 8.2 times household income, against a 20-year average of 6.8.',
    url: 'https://www.cotality.com/au/insights/articles/australias-housing-affordability-hits-new-lows',
  },
  {
    title: 'Long-run trends in housing price growth',
    publisher: 'Reserve Bank of Australia, Bulletin, September 2015',
    detail: 'Deregulation and low inflation lifted borrowing in a one-off shift that took over a decade; supply and population matter more since.',
    url: 'https://www.rba.gov.au/publications/bulletin/2015/sep/3.html',
  },
  {
    title: 'City sizes, house prices and wealth',
    publisher: 'Reserve Bank of Australia, Bulletin, December 2001',
    detail: 'Prices rose much faster than incomes through the 1990s as credit was deregulated and inflation fell.',
    url: 'https://www.rba.gov.au/publications/bulletin/2001/dec/1.html',
  },
  {
    title: 'Financial markets and the Bank’s operations',
    publisher: 'Reserve Bank of Australia, Annual Report 1990',
    detail: 'Banks held housing loan rates at 17% from 1989.',
    url: 'https://www.rba.gov.au/publications/annual-reports/rba/1990/fin-mar-bank-ope.html',
  },
  {
    title: 'No Price Like Home: Global House Prices, 1870–2012',
    publisher: 'Knoll, Schularick and Steger, American Economic Review, 2017',
    detail: 'Real house prices were flat for decades, then roughly tripled after 1950, mostly from land.',
    url: 'https://www.cesifo.org/DocDL/cesifo1_wp5006.pdf',
  },
  {
    title: 'A long run house price index: the Herengracht index, 1628–1973',
    publisher: 'Piet Eichholtz, Real Estate Economics, 1997',
    detail: 'Amsterdam canal houses were worth only about twice as much after inflation in 1973 as in 1628.',
    url: 'https://ideas.repec.org/a/bla/reesec/v25y1997i2p175-192.html',
  },
  {
    title: 'The rate of return on everything, 1870–2015',
    publisher: 'Jordà, Knoll, Kuvshinov, Schularick and Taylor, FRBSF Working Paper 2017-25',
    detail: 'Housing and shares both returned about 7% a year after inflation across 16 countries, housing with half the volatility.',
    url: 'https://www.frbsf.org/research-and-insights/publications/working-papers/2017/12/the-rate-of-return-on-everything-1870-2015',
  },
  {
    title: 'Negative gearing and capital gains tax reform',
    publisher: 'Budget 2026–27 Tax Explainer',
    detail: 'From 1 July 2027: negative gearing only for new builds; CGT indexation and a 30% minimum tax replace the 50% discount.',
    url: 'https://budget.gov.au/content/factsheets/download/tax-explainers-negative-gearing-capital-gains-tax.pdf',
  },
];

/** The record multiple and its 20-year average (Cotality, Sep 2025) */
const MULTIPLE_NOW = 8.2;
const MULTIPLE_AVERAGE = 6.8;
/** APRA's serviceability buffer, percentage points */
const BUFFER = 3;
const TERM_MONTHS = 360;

/** Loan a monthly repayment supports over 30 years at an annual rate (%) */
function loanFor(repayment: number, rate: number): number {
  const r = rate / 100 / 12;
  return r === 0 ? repayment * TERM_MONTHS : (repayment * (1 - Math.pow(1 + r, -TERM_MONTHS))) / r;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="m-0 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="flex max-w-3xl flex-col gap-4 text-[17px] leading-relaxed text-ink-2 [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}

function Slider({ label, value, min, max, step, onChange, display }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3 text-sm text-ink-2">
        {label}
        <span className="font-mono text-base text-ink">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[var(--color-ink)]" aria-valuetext={display} />
    </label>
  );
}

function BorrowingPower() {
  const [rate, setRate] = useState(6);
  const repayment = 3000;
  const rows = [17, 12, 9, 6, 3].map((r) => ({ rate: r, loan: loanFor(repayment, r + BUFFER) }));
  const max = Math.max(...rows.map((r) => r.loan), loanFor(repayment, rate + BUFFER));
  const current = loanFor(repayment, rate + BUFFER);
  return (
    <div className="card flex flex-col gap-5 px-5 py-5 sm:px-6">
      <p className="m-0 text-sm text-ink-2">
        How much a {formatCurrency(repayment)} monthly repayment borrows over 30 years, tested at the loan rate plus APRA's{' '}
        {BUFFER}-point buffer.
      </p>
      <Slider label="Mortgage rate" value={rate} min={1} max={18} step={0.25} onChange={setRate} display={`${rate}%`} />
      <div className="flex flex-col gap-2">
        {[...rows.filter((r) => r.rate !== rate), { rate, loan: current, mine: true }]
          .sort((a, b) => b.rate - a.rate)
          .map((row) => (
            <div key={`${row.rate}-${'mine' in row}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm">
              <span className={`font-mono ${'mine' in row ? 'font-semibold text-ink' : 'text-ink-2'}`}>{row.rate}%</span>
              <span className="h-3 rounded-sm bg-raised">
                <span className={`block h-3 rounded-sm ${'mine' in row ? 'bg-ink' : 'bg-line-strong'}`} style={{ width: `${(row.loan / max) * 100}%` }} />
              </span>
              <span className={`text-right font-mono ${'mine' in row ? 'font-semibold text-ink' : 'text-ink-2'}`}>{formatCurrency(Math.round(row.loan / 1000) * 1000)}</span>
            </div>
          ))}
      </div>
      <p className="m-0 text-sm text-ink-2">
        The same repayment borrows <strong className="font-semibold text-ink">{(loanFor(repayment, 3 + BUFFER) / loanFor(repayment, 17 + BUFFER)).toFixed(1)}×</strong> as
        much at 3% as at 17%. Buyers bid with what they can borrow, so prices rose to meet it.
      </p>
    </div>
  );
}

function MultipleArithmetic() {
  const [growth, setGrowth] = useState(5);
  const [income, setIncome] = useState(3.5);
  const [years, setYears] = useState(20);
  const factor = Math.pow((1 + growth / 100) / (1 + income / 100), years);
  const end = MULTIPLE_NOW * factor;
  return (
    <div className="card flex flex-col gap-5 px-5 py-5 sm:px-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Slider label="Price growth" value={growth} min={1} max={8} step={0.25} onChange={setGrowth} display={`${growth}%`} />
        <Slider label="Income growth" value={income} min={1} max={6} step={0.25} onChange={setIncome} display={`${income}%`} />
        <Slider label="Years" value={years} min={5} max={40} step={1} onChange={setYears} display={`${years}`} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-4xl font-medium tracking-tight">{MULTIPLE_NOW}× → {end.toFixed(1)}×</span>
        <span className="text-sm text-muted">dwelling value ÷ household income</span>
      </div>
      <p className="m-0 text-sm text-ink-2">
        {Math.abs(factor - 1) < 0.02
          ? 'Prices keep pace with incomes, so homes stay as affordable as they are now.'
          : factor > 1
            ? <>Homes become {Math.round((factor - 1) * 100)}% less affordable again, on top of today's record. Something has to supply the extra borrowing power: lower rates, longer loans, looser lending or bigger family help.</>
            : <>Homes become more affordable{end <= MULTIPLE_AVERAGE ? `, back to or below the 20-year average of ${MULTIPLE_AVERAGE}×` : ''}.</>}
      </p>
    </div>
  );
}

const COMPARISON: [string, string, string][] = [
  ['What you own', 'A building, which wears out, on land, which holds the value, in one place', 'Slices of thousands of businesses in many countries'],
  ['Where the return comes from', 'Rent, plus price growth that over decades tracks what buyers can borrow', 'Dividends, plus profit growth, plus or minus changes in what investors pay per dollar of profit'],
  ['What caps it', 'Local incomes and credit rules', 'The size of the economy and companies’ profit share; valuations can stretch, then snap back'],
  ['Borrowing', 'Easy: 80–95% of the price, at home loan rates', 'Harder and dearer: margin loans, usually up to 70–75% on a broad fund, at higher rates'],
  ['Buying and selling costs', 'Stamp duty 3–5%, agent and legal 2–3%, months to sell', 'Brokerage of a few dollars; sells in a day, in any amount'],
  ['Holding costs', 'Maintenance, rates, insurance, strata, land tax', 'A fund fee of 0.05–0.3% a year'],
  ['Tax', 'Your home is CGT-free; rentals get negative gearing only on new builds from July 2027', 'Franking credits; CGT indexation and a 30% minimum tax from July 2027, as for property'],
  ['Who sets the price', 'Buyers nearby, using mostly borrowed money', 'Investors worldwide, using mostly their own'],
];

export default function HousingExplainer({ onOpenInvest, onOpenCalculator }: { onOpenInvest: () => void; onOpenCalculator: () => void }) {
  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-14 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <section aria-label="About this page" className="flex max-w-3xl flex-col gap-3">
        <span className="eyebrow">Explainer</span>
        <h1 className="m-0 text-4xl leading-none font-bold tracking-tighter sm:text-6xl">How house prices work over decades</h1>
        <p className="m-0 text-lg leading-relaxed text-ink-2">
          Every growth rate in these calculators is a bet on the next 20 or 30 years, so it helps to know what has driven
          prices in the past, what can't happen twice, and how housing differs from the share market.
        </p>
      </section>

      <Section eyebrow="1 · The anchor" title="Prices are set by what buyers can borrow">
        <p>
          Most homes are bought with a loan, and banks lend a multiple of income: whatever the repayments allow, after a
          stress test. So the most a typical buyer can pay depends on <strong>their income</strong>, <strong>interest
          rates</strong>, <strong>the loan term and deposit rules</strong>, and <strong>how many incomes the household
          has</strong>. When all buyers can borrow more, they bid against each other and the extra ends up in the price.
        </p>
        <BorrowingPower />
        <p>
          That's why price-to-income is the number to watch. Households can't spend an ever-growing share of their income on
          housing, so over long periods prices can't grow much faster than incomes, unless something else keeps raising how much
          each dollar of income can borrow.
        </p>
      </Section>

      <Section eyebrow="2 · The last 35 years" title="Why prices outran incomes, and why it can't repeat">
        <p>
          Bank home loan rates sat at <strong>17%</strong> in 1989. Through the 1990s banking was deregulated and inflation
          fell, and by 2021 new loans cost under 3%. Two incomes per household became normal. The Reserve Bank calls these one-off
          shifts: borrowing capacity jumped, the household debt-to-income ratio climbed for over a decade and then levelled off,
          and prices rose about 4.5% a year faster than inflation from 1990 to the mid-2000s.
        </p>
        <p>
          The result: Australian homes now cost a record <strong>{MULTIPLE_NOW} times</strong> household income, against a
          20-year average of {MULTIPLE_AVERAGE} (Cotality, 2025). Rates can't fall from 17% to under 3% again, and most households already have
          two incomes. Without another tailwind like that, prices should grow at about the pace of incomes, around 3–3.5% a year.
        </p>
      </Section>

      <Section eyebrow="3 · The arithmetic" title="What a growth assumption really says">
        <p>
          A price growth rate is also a claim about affordability. If prices grow faster than incomes, the multiple keeps
          climbing. Try the 5% a year that's often assumed:
        </p>
        <MultipleArithmetic />
        <p>
          Before assuming prices outpace incomes for decades, ask where the borrowing power comes from. The calculators here
          default to 4%: incomes, plus a little for scarce land and a growing population.
        </p>
      </Section>

      <Section eyebrow="4 · The very long run" title="Buildings wear out; land is what rises">
        <p>
          Over a century or more, real house prices have mostly gone sideways. Amsterdam's Herengracht canal houses were worth
          only about twice as much after inflation in 1973 as in 1628: around 0.2% a year. Across 14 rich countries, real
          prices barely moved from 1870 to 1950, then roughly tripled, and about 80% of that rise came from <strong>land</strong>,
          as cities grew and good locations got scarcer.
        </p>
        <p>
          A house is two assets: a building that depreciates and needs constant upkeep, and the land under it, whose value
          reflects what people earn nearby and how close it is to jobs. That's why apartments, with little land per home, have grown
          more slowly than houses, and why a new build's price includes a building that starts ageing on day one.
        </p>
      </Section>

      <Section eyebrow="5 · The caveats" title="Income isn't the whole story">
        <p>
          The anchor is borrowing power, not income alone, and that can drift for a long time. Longer loan terms, smaller deposits (the 5% Deposit Scheme), looser stress tests or falling rates would all let prices
          outrun incomes again for a while.
        </p>
        <p>
          Wealth matters as well as income. Inheritances, help from parents, and owners borrowing against the equity they already
          have let some buyers pay more than their income alone allows, and that money is growing as older Australians pass on
          their homes. And the national average hides big differences: where population grows faster than new housing,
          prices can outrun local incomes for years. The RBA found that this gap between demand and supply explained more of
          the price growth in the decade to 2015 than borrowing did.
        </p>
      </Section>

      <Section eyebrow="6 · The contrast" title="How shares differ">
        <p>
          A share fund owns businesses. Its return is <strong>dividends</strong>, plus <strong>growth in profits</strong>, plus
          or minus <strong>changes in valuation</strong> (what investors pay per dollar of profit). Profits come from selling to
          the whole world and reinvesting, not from how much your neighbours can borrow, so the cap is the size of the global
          economy, not local incomes. Valuations work like price-to-income: they can climb for years, but not forever.
        </p>
        <p>
          Over 1870–2015, across 16 countries, housing and shares both returned about <strong>7% a year after
          inflation</strong>, and housing was about half as volatile. But most of housing's return was <strong>rent</strong>, not
          price growth, and those figures are for whole national markets, before buying and selling costs and taxes. One
          house in one suburb is a much riskier bet than the national average.
        </p>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-[14px] leading-snug">
            <thead>
              <tr>
                <th scope="col" className="w-[22%] px-4 py-3 text-left"><span className="sr-only">Feature</span></th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold">
                  <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-buy" />Property</span>
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold">
                  <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-rent" />Shares</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([label, property, shares]) => (
                <tr key={label} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-ink">{label}</th>
                  <td className="px-4 py-3 text-ink-2">{property}</td>
                  <td className="px-4 py-3 text-ink-2">{shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The biggest practical difference is <strong>leverage</strong>. Banks happily lend 80–95% against a home, so a
          property investor earns growth on the whole price while putting in a fraction of it. If prices beat the loan rate after
          costs, that magnifies the gain; if they don't, it magnifies the loss. In practice, property versus shares mostly
          comes down to whether you'd borrow the same amount to buy shares, and you can test exactly that.
        </p>
      </Section>

      <section className="flex flex-wrap gap-3">
        <button type="button" onClick={onOpenInvest} className="min-h-12 rounded-xl bg-ink px-5 text-[15px] font-semibold text-ground">
          Compare an investment property with shares
        </button>
        <button type="button" onClick={onOpenCalculator} className="min-h-12 rounded-xl border border-line-strong bg-surface px-5 text-[15px] font-semibold">
          Compare renting with buying
        </button>
      </section>

      <section aria-label="Sources" className="flex max-w-3xl flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold">Sources</h2>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {SOURCES.map((s) => (
            <li key={s.url} className="flex flex-col gap-0.5 border-t border-line pt-3">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline hover:text-ink-2">{s.title}</a>
              <span className="text-xs text-muted">{s.publisher}</span>
              <span className="text-xs leading-snug text-ink-2">{s.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
