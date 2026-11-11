import type { ReactNode } from 'react';
import type { InvestmentInputs, PropertyInputs, RentInputs, ScenarioValue } from '../types';
import type { IpInputs } from '../utils/investmentProperty';
import { stampDutyFor } from '../utils/investmentProperty';
import { NEW_HOME_DRAG_YEARS, NEW_HOME_GROWTH_DRAG, isScenarioValue } from '../utils/calculations';
import { MINIMUM_GAIN_TAX } from '../utils/cgtReform';
import { PENSION_AGE, SUPER_ACCESS_AGE } from '../utils/retirement';
import { ACT_DUTY_PHASE_OUT_YEARS } from '../utils/stampDuty';
import { landTaxToday } from '../utils/landTax';
import { DEFAULT_CORRELATION_MATRIX, DEFAULT_VARIABLE_MODELS } from '../utils/distributions';
import { DEFAULT_HORIZON, DEFAULT_INVESTMENT, DEFAULT_IP, DEFAULT_PROPERTY, DEFAULT_RENT, MONTE_CARLO_ITERATIONS } from '../defaults';
import { CITIES } from '../cities';
import { PORTFOLIOS } from '../portfolios';
import { formatCurrency } from '../utils/format';
import type { GuideTab } from '../utils/shareState';
import Segmented from './Segmented';

// Every input and built-in rule of the two calculators, in plain words. Default values are read
// from defaults.ts and the model files, so this page can't drift from what the models use; the
// descriptions and sources restate the comments beside each figure in defaults.ts, cities.ts,
// portfolios.ts, stampDuty.ts, landTax.ts, homeBuyerSupport.ts, retirement.ts, cgtReform.ts,
// investmentProperty.ts and distributions.ts.

interface Row {
  name: string;
  /** The default, formatted */
  value: string;
  /** The reader's current value, when it differs from the default */
  yours?: string;
  what: ReactNode;
  source?: ReactNode;
}

interface Group {
  title: string;
  intro?: string;
  rows: Row[];
}

const money = formatCurrency;
const pct = (n: number) => `${+n.toFixed(2)}%`;
const years = (n: number) => (n === 1 ? '1 year' : `${n} years`);
const perYear = (n: number) => `${money(n)} a year`;
const rate = (v: number | ScenarioValue) =>
  isScenarioValue(v) ? `${pct(v.baseline)} (${pct(Math.min(v.pessimistic, v.optimistic))} to ${pct(Math.max(v.pessimistic, v.optimistic))} in the low and high cases)` : pct(v);

/** A default and, when the reader has changed it, their value. */
function pair<T>(fallback: T, current: T, format: (v: T) => string): Pick<Row, 'value' | 'yours'> {
  const value = format(fallback);
  const yours = format(current);
  return yours === value ? { value } : { value, yours };
}

function Rows({ group }: { group: Group }) {
  return (
    <section className="card overflow-hidden p-0">
      <header className="flex flex-col gap-1 border-b border-line px-5 py-4 sm:px-6">
        <h3 className="m-0 text-base font-semibold">{group.title}</h3>
        {group.intro && <p className="m-0 max-w-3xl text-sm leading-snug text-ink-2">{group.intro}</p>}
      </header>
      <dl className="m-0">
        {group.rows.map((row) => (
          <div key={row.name} className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-line px-5 py-4 first:border-t-0 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:px-6">
            <dt className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{row.name}</span>
              <span className="font-mono text-[13px] leading-snug text-ink-2">{row.value}</span>
              {row.yours && (
                <span className="w-fit rounded-md bg-raised px-2 py-0.5 font-mono text-[13px] leading-snug text-ink">Yours: {row.yours}</span>
              )}
            </dt>
            <dd className="m-0 flex flex-col gap-1.5 text-[15px] leading-relaxed text-ink-2 [&_strong]:font-semibold [&_strong]:text-ink">
              <span>{row.what}</span>
              {row.source && <span className="text-[13px] leading-snug text-muted">{row.source}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="m-0 flex max-w-3xl list-none flex-col gap-3 p-0">
      {steps.map((step, i) => (
        <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 text-[16px] leading-relaxed text-ink-2 [&_strong]:font-semibold [&_strong]:text-ink">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-raised font-mono text-sm text-ink">{i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="m-0 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{title}</h2>
      {children && <p className="m-0 text-[16px] leading-relaxed text-ink-2">{children}</p>}
    </div>
  );
}

function LeftOut({ items }: { items: [string, string][] }) {
  return (
    <ul className="m-0 flex max-w-3xl list-none flex-col gap-3 p-0">
      {items.map(([title, text]) => (
        <li key={title} className="border-t border-line pt-3 text-[15px] leading-relaxed text-ink-2">
          <strong className="font-semibold text-ink">{title}.</strong> {text}
        </li>
      ))}
    </ul>
  );
}

// ---- Rent or buy -------------------------------------------------------------------------

interface BuyValues {
  property: PropertyInputs;
  rent: RentInputs;
  investment: InvestmentInputs;
  horizon: number;
}

const cityName = (id: string | undefined) => CITIES.find((c) => c.id === id)?.name ?? 'Custom';
const portfolioName = (id: string | undefined) => {
  const p = PORTFOLIOS.find((x) => x.id === id);
  return p ? `${p.name} (${p.example})` : 'Custom';
};

function buyGroups({ property: p, rent: r, investment: inv, horizon }: BuyValues): Group[] {
  const P = DEFAULT_PROPERTY;
  const R = DEFAULT_RENT;
  const I = DEFAULT_INVESTMENT;
  const lvr = (x: PropertyInputs) => `${money(x.deposit)} (${pct((x.deposit / x.propertyPrice) * 100)} of the price)`;
  return [
    {
      title: 'The home',
      rows: [
        {
          name: 'Location', ...pair(P.location, p.location, cityName),
          what: 'Fills in the price, rent, state, council and water bill and building insurance for a typical home in that city. Changing any of those by hand makes the location "Custom".',
          source: 'Prices: Cotality Home Value Index, median dwelling, 30 Sep 2026. Rents: Cotality Quarterly Rental Review, June quarter 2026. Insurance: Finity average premiums by capital, Oct 2025. Council and water: rough per-city estimates.',
        },
        {
          name: 'Purchase price', ...pair(P.propertyPrice, p.propertyPrice, money),
          what: 'What the buyer pays. The loan, stamp duty, maintenance and selling costs all scale with it.',
          source: 'The city\'s median dwelling value, rounded to $5,000.',
        },
        {
          name: 'Deposit', ...pair(P, p, lvr),
          what: 'Cash put in on day one; the rest is borrowed. The renter starts with the same cash and invests it. Under 20% usually adds lenders mortgage insurance.',
          source: 'Default is 20% of the price, the most common way to avoid mortgage insurance.',
        },
        {
          name: 'State rules', ...pair(P.state ?? 'None', p.state ?? 'None', String),
          what: 'Picks the stamp duty schedule, the first home owner grant and the 5% Deposit Scheme price cap. With "None" you type the stamp duty yourself.',
          source: 'Each state revenue office\'s rates for contracts in 2026–27.',
        },
        {
          name: 'Buyer', ...pair(P.firstHomeBuyer ?? false, p.firstHomeBuyer ?? false, (x) => (x ? 'First home buyer' : 'Owned before')),
          what: 'First home buyers get stamp duty relief, a grant on new homes in most states, and no mortgage insurance with a 5% deposit under the price cap.',
          source: 'Judgment call: someone weighing renting against buying usually hasn\'t bought before.',
        },
        {
          name: 'Home', ...pair(P.newHome ?? false, p.newHome ?? false, (x) => (x ? 'New' : 'Established')),
          what: `A new home qualifies for first home owner grants and, in some states, no stamp duty. Its value is assumed to grow ${NEW_HOME_GROWTH_DRAG} point a year slower for its first ${NEW_HOME_DRAG_YEARS} years: you pay a premium for new, and more of the price is a building that wears out.`,
          source: 'The slower growth is a judgment call; there is no rigorous Australian estimate.',
        },
        {
          name: 'Stamp duty', ...pair(P.stampDuty, p.stampDuty, money),
          what: 'Worked out from the price, state, buyer and home type every time one changes. It is cash gone on day one, so the renter gets to invest the same amount.',
          source: 'State schedules for 2026–27, including first home buyer exemptions and concessions.',
        },
        {
          name: 'First home owner grant', ...pair(P.firstHomeGrant ?? 0, p.firstHomeGrant ?? 0, money),
          what: 'Paid to first home buyers on new homes under each state\'s price cap. It reduces the cash the buyer needs up front.',
          source: 'NSW $10k to $600k; VIC $10k to $750k; QLD $30k to $750k; WA $10k to $750k; SA $15k; TAS $20k; NT $50k to $750k; ACT none (2026–27).',
        },
        {
          name: 'Lenders mortgage insurance', ...pair(P.lmi ?? 0, p.lmi ?? 0, money),
          what: 'Charged when the loan is over 80% of the price, and added to the loan. Estimated at 1% of the loan up to 85%, 2% up to 90%, 3.5% up to 95% and 4.5% above. Waived for first home buyers with at least 5% down under the 5% Deposit Scheme price cap. You can type your own figure.',
          source: 'Rough: midway through published insurer premium tables. Real quotes vary by lender and loan size.',
        },
        {
          name: 'Other costs', ...pair(P.otherPurchaseCosts, p.otherPurchaseCosts, money),
          what: 'Conveyancing, inspections, loan fees and moving in. Paid on day one, and again each time the owner moves.',
          source: 'Rough: conveyancing about $2k, inspections $600, loan and registration fees $1k, moving in $2–3k.',
        },
      ],
    },
    {
      title: 'The loan',
      rows: [
        {
          name: 'Interest rate', ...pair(P.interestRate, p.interestRate, rate),
          what: 'A variable rate held at this level for the whole loan, so it should be a long-run average, not today\'s rate. Repayments are principal and interest.',
          source: 'The Reserve Bank\'s discounted variable rate averaged 5.79% over 30 years; new owner-occupier loans were about 6.2% in Aug 2026 (RBA tables F5 and F6).',
        },
        {
          name: 'Term', ...pair(P.loanTerm, p.loanTerm, years),
          what: 'Years to repay the loan. Once it is paid off, owning costs much less than renting and the owner invests the difference.',
          source: 'The standard Australian home loan term.',
        },
        {
          name: 'Offset balance', ...pair(P.offsetAccountBalance ?? 0, p.offsetAccountBalance ?? 0, money),
          what: 'Savings the buyer keeps in an offset account. Interest is charged on the loan less this balance, so it earns the mortgage rate, tax-free. The renter starts with the same amount and invests it.',
          source: 'Rough: a modest emergency buffer.',
        },
        {
          name: 'Buyer\'s spare cash', ...pair(I.buyerSurplusToOffset ?? true, inv.buyerSurplusToOffset ?? true, (x) => (x ? 'Offset first, then invest' : 'Invest it')),
          what: 'In months when owning is cheaper than renting, the buyer saves the difference. By default it goes into the offset until the offset equals the loan, then into shares.',
          source: 'Money in an offset earns the loan rate with no risk and no tax, the usual choice while a loan is outstanding.',
        },
      ],
    },
    {
      title: 'Renting instead',
      rows: [
        {
          name: 'Rent a month', ...pair(R.monthlyRent, r.monthlyRent, money),
          what: 'Rent on a comparable home today. This is the renter\'s main cost and the buyer\'s main saving.',
          source: 'The city\'s median weekly rent, all dwellings (Cotality, June quarter 2026).',
        },
        {
          name: 'Rent growth', ...pair(R.rentIncreaseRate, r.rentIncreaseRate, rate),
          what: 'How fast rent rises each year. One of the variables that moves the answer most, because it compounds for decades.',
          source: 'Rents track incomes over the long run, and wages grow about 3–3.5% a year. The 2021–24 surge isn\'t treated as a trend.',
        },
        {
          name: 'Renter moves every', ...pair(R.movingFrequency, r.movingFrequency, years),
          what: 'How often the renter has to move, paying the cost per move each time.',
          source: 'Rough: leases often run 12 months, but renters typically stay a few years.',
        },
        {
          name: 'Cost per move', ...pair(R.movingCost, r.movingCost, money),
          what: 'Removalists, cleaning, connections and overlapping rent. Rises with inflation. Owners pay it too when they move.',
          source: 'Rough estimate for a local move.',
        },
        {
          name: 'Owner moves every', ...pair(P.ownerMoveFrequency ?? 0, p.ownerMoveFrequency ?? 0, (x) => (x > 0 ? years(x) : 'Never')),
          what: 'Each time, the owner sells and buys a home of the same value: selling costs, full stamp duty (no first-home relief), other purchase costs and the cost of a move. The loan carries over. Set to 0 for an owner who never moves.',
          source: 'Sellers had held houses about 9 years and units about 8 (Domain, 2025; Cotality Pain and Gain, June quarter 2026).',
        },
      ],
    },
    {
      title: 'Costs of owning',
      intro: 'Council, insurance and strata rise with inflation. Maintenance rises with the home\'s value.',
      rows: [
        {
          name: 'Maintenance', ...pair(P.maintenanceRate, p.maintenanceRate, (x) => `${pct(x)} of the home's value a year`),
          what: 'Repairs and replacements: roofs, hot water, paint, kitchens. Renters don\'t pay it.',
          source: 'Rough: the common 1%-a-year rule of thumb (1–2% is often quoted).',
        },
        {
          name: 'Strata', ...pair(P.strataLevies ?? 0, p.strataLevies ?? 0, perYear),
          what: 'Body corporate levies for apartments and townhouses. The default is a freestanding house.',
          source: 'Rough guide: small blocks $2–5k a year, high-rises with lifts $8k or more.',
        },
        {
          name: 'Council and water', ...pair(P.councilRates, p.councilRates, perYear),
          what: 'Council rates and water charges, paid by the owner.',
          source: 'Rough per-city estimates.',
        },
        {
          name: 'Building insurance', ...pair(P.buildingInsurance, p.buildingInsurance, perYear),
          what: 'Home building cover, paid by the owner.',
          source: 'Finity\'s average home insurance premium for the city, Oct 2025.',
        },
        {
          name: 'Contents insurance', ...pair([P.contentsInsurance, R.contentsInsurance], [p.contentsInsurance, r.contentsInsurance], ([o, t]) => `${money(o)} owner, ${money(t)} renter, a year`),
          what: 'Both households insure the same belongings, so by default this cancels out.',
          source: 'Rough: a basic contents policy.',
        },
        {
          name: 'Selling costs', ...pair(P.sellingCostRate, p.sellingCostRate, (x) => `${pct(x)} of the sale price`),
          what: 'Agent commission, marketing and legal fees, paid when the home is sold at the end and at each owner move.',
          source: 'Rough: commission of about 2–2.5% in the capitals, plus marketing and conveyancing.',
        },
        {
          name: 'Capital gains tax on the home', ...pair(P.capitalGainsTaxRate, p.capitalGainsTaxRate, pct),
          what: 'Your own home is exempt from capital gains tax, so this is zero. A rate entered here taxes half the gain at that rate.',
          source: 'Main residence exemption (ATO).',
        },
      ],
    },
    {
      title: 'Markets',
      rows: [
        {
          name: 'Property growth', ...pair(I.propertyGrowthRate, inv.propertyGrowthRate, rate),
          what: 'How fast the home\'s value rises each year, before inflation is taken out. With rent growth and share returns, one of the three numbers that decide the result.',
          source: 'Incomes grow about 3–3.5% a year, plus a little for scarce land. The fall in interest rates from 1990 to 2021 that pushed prices faster can\'t repeat. See the Long Run page.',
        },
        {
          name: 'Invest savings in', ...pair(I.portfolio, inv.portfolio, portfolioName),
          what: 'A preset that fills in the return, dividend yield, franking, fee and volatility below.',
          source: 'Vanguard Index Chart 2026 (30 years of history) blended with Vanguard\'s forward-looking model, May 2026; yields and franking from fund factsheets, Aug 2026.',
        },
        {
          name: 'Total return', ...pair(I.stockMarketReturn, inv.stockMarketReturn, rate),
          what: 'The fund\'s yearly return including dividends, before fees and tax.',
          source: 'From the portfolio preset. The low and high cases are judgment calls about 2 points either side.',
        },
        {
          name: 'Dividend yield', ...pair(I.dividendYield ?? 0, inv.dividendYield ?? 0, pct),
          what: 'The part of the return paid out as dividends. It doesn\'t change the total return, only how much is taxed every year instead of when the shares are sold.',
          source: 'From the portfolio preset.',
        },
        {
          name: 'Franked', ...pair(I.frankingLevel ?? 0, inv.frankingLevel ?? 0, (x) => `${pct(x)} of dividends`),
          what: 'Franked dividends come with a credit for the 30% company tax already paid, which reduces your tax on them. Credits bigger than the tax are refunded.',
          source: 'From the portfolio preset.',
        },
        {
          name: 'Dividends', ...pair(I.dividendReinvestment ?? true, inv.dividendReinvestment ?? true, (x) => (x ? 'Reinvested' : 'Held as cash')),
          what: 'After tax, dividends buy more shares, or sit as cash earning nothing.',
        },
        {
          name: 'Fund fee', ...pair(I.managementFee ?? 0, inv.managementFee ?? 0, (x) => `${pct(x)} a year`),
          what: 'The fund\'s management fee, taken off the return every year.',
          source: 'From the portfolio preset.',
        },
        {
          name: 'Brokerage', ...pair(I.stockTransactionCost, inv.stockTransactionCost, (x) => `${pct(x)} of each trade`),
          what: 'Charged on every purchase, including reinvested dividends, and on the final sale.',
          source: 'Rough: a few dollars a trade on regular monthly buys.',
        },
        {
          name: 'Share of the monthly saving invested', ...pair(I.investedShare ?? 100, inv.investedShare ?? 100, pct),
          what: 'Whoever has the cheaper housing that month invests this share of the difference and spends the rest. At 100% the renter invests every dollar saved, which takes discipline; lower it to test what happens if they don\'t.',
          source: 'Judgment call: 100% is the textbook comparison.',
        },
        {
          name: 'Inflation', ...pair(I.inflationRate, inv.inflationRate, (x) => `${pct(x)} a year`),
          what: 'Raises council rates, insurance, strata, moving costs, pension rates and tax thresholds each year. Also used to show results in today\'s dollars and to index share purchases for capital gains tax.',
          source: 'Midpoint of the Reserve Bank\'s 2–3% target.',
        },
      ],
    },
    {
      title: 'Tax and your household',
      rows: [
        {
          name: 'Income tax rate', ...pair(I.marginalTaxRate, inv.marginalTaxRate, pct),
          what: 'Your top tax rate including the 2% Medicare levy. Dividends are taxed at it every year, and capital gains when shares are sold all at once.',
          source: 'Default is the 37% bracket ($135k to $190k) plus Medicare.',
        },
        {
          name: 'Capital gains tax on shares', ...pair(I.cgtRules ?? 'reform', inv.cgtRules ?? 'reform', (x) => (x === 'reform' ? 'From July 2027 (law)' : 'Old rules: 50% discount')),
          what: `Under the law from 1 July 2027, gains made before that date keep the 50% discount. After it, each purchase is adjusted for inflation and the whole real gain is taxed, at no less than ${MINIMUM_GAIN_TAX * 100}%. People on the age pension are exempt from that minimum. "Old rules" taxes half of every gain, for comparison.`,
          source: 'Budget 2026–27 tax explainer and ATO guidance (June 2026). The months left until July 2027 are counted from today.',
        },
        {
          name: 'Selling shares', ...pair(I.spreadSale ?? false, inv.spreadSale ?? false, (x) => (x ? 'Gradually' : 'All at once, at your income tax rate')),
          what: 'All at once taxes the whole gain at your income tax rate. Gradually splits the gain evenly across a number of years (and two people, for a couple) and taxes each slice through the tax brackets on top of other income, which is usually much less tax.',
          source: 'Brackets are the 2027–28 resident rates with the low income tax offset and Medicare levy.',
        },
        {
          name: 'Selling over', ...pair([I.saleYears ?? 10, I.saleIncome ?? 0], [inv.saleYears ?? 10, inv.saleIncome ?? 0], ([y, o]) => `${years(y)}, with ${money(o)} other income each`),
          what: 'Only used when selling gradually: how many years the sale is spread over, and each person\'s other taxable income in those years, in today\'s dollars.',
          source: 'Judgment call: a decade of retirement with no other taxable income.',
        },
        {
          name: 'Age today', ...pair(I.age ?? 35, inv.age ?? 35, String),
          what: `Decides when the age pension starts (${PENSION_AGE}), when salary sacrifice into super stops, and when super can be withdrawn tax-free (${SUPER_ACCESS_AGE}).`,
          source: 'Mean first home buyer age for an established home (ABS Survey of Income and Housing 2017–18).',
        },
        {
          name: 'Household', ...pair(I.couple ?? true, inv.couple ?? true, (x) => (x ? 'Couple' : 'Single')),
          what: 'Sets pension and rent assistance rates, and whether a gradual share sale is split between two people.',
        },
        {
          name: 'Saving into super', ...pair(I.superShare ?? 0, inv.superShare ?? 0, (x) => `${pct(x)} of each invested saving`),
          what: 'This share of each saving is salary-sacrificed into super instead of buying shares, until pension age. Each after-tax dollar given up puts more into super, because contributions are taxed at 15% instead of your income tax rate.',
          source: 'Off by default.',
        },
        {
          name: 'Super cap room', ...pair(I.superCapRoom ?? 0, inv.superCapRoom ?? 0, perYear),
          what: 'The most that can be salary-sacrificed each year, before tax, for the household. Rises with inflation.',
          source: 'Rough: two earners on half the Brisbane median household income each have the $32,500 cap (2026–27) less about $6,800 of employer super.',
        },
      ],
    },
    {
      title: 'Time and display',
      rows: [
        {
          name: 'Horizon', ...pair(DEFAULT_HORIZON, horizon, years),
          what: 'How many years are simulated. "Sell after" picks the year both households cash out; by default it is the last year.',
          source: 'Matches the loan term, so the default shows the whole loan.',
        },
        {
          name: 'Low and high cases', value: 'On',
          what: 'Re-runs everything with the low and high values of the interest rate, rent growth, share return and property growth, to show a range beside the baseline.',
        },
        {
          name: 'Today\'s dollars', value: 'Off',
          what: 'Divides every figure by inflation up to the sell year so it reads in today\'s buying power. It changes how results are shown, not who comes out ahead. Totals paid along the way (interest, rent, stamp duty) are converted at the sell year\'s price level too, so the lines still add up; they read smaller than the amounts paid at the time.',
        },
        {
          name: 'Household income', value: 'Blank',
          what: 'Only used by the affordability card (repayments as a share of income, loan as a multiple of income). It doesn\'t affect the comparison.',
        },
      ],
    },
  ];
}

const BUY_STEPS: ReactNode[] = [
  <><strong>Both households start with the same cash:</strong> the deposit, stamp duty and other purchase costs (less any grant), plus the offset balance. The buyer spends it on the purchase and keeps the offset. The renter invests all of it.</>,
  <><strong>Each month both spend the same total.</strong> The owner pays the loan repayment, maintenance, council and water, insurance and strata. The renter pays rent and contents insurance. Whoever pays less invests the difference. Early on that is usually the renter; once the loan is paid off it is the owner.</>,
  <><strong>Everything grows.</strong> The home rises at the property growth rate while the loan is paid down. Shares earn the total return less the fund fee; dividends are taxed every year and reinvested.</>,
  <><strong>From age {PENSION_AGE}</strong> each household gets whatever age pension the means tests allow. The home is exempt from the assets test, which favours the owner; renters get rent assistance. Whoever gets more pension invests the difference.</>,
  <><strong>At the sell year both cash out.</strong> The owner sells the home, pays selling costs and the rest of the loan, and pays no capital gains tax. Both sell their shares and pay brokerage and capital gains tax. What is left is each household's net worth, and the gap between them is the answer.</>,
];

function buyBuiltIn(): Group[] {
  const m = DEFAULT_VARIABLE_MODELS;
  const c = DEFAULT_CORRELATION_MATRIX;
  return [
    {
      title: 'Rules built into the model',
      intro: 'These can\'t be changed on the page. They are fixed in the code, each with its source.',
      rows: [
        {
          name: 'Steps', value: 'Monthly',
          what: 'Repayments, rent, growth and investing are worked out month by month. Rent, running costs and tax thresholds step up once a year.',
        },
        {
          name: 'Loan repayments', value: 'Principal and interest',
          what: 'A fixed monthly repayment that clears the loan over the term, recalculated only if the rate changes (it does in the Risk view). Interest is charged on the loan less the offset balance, so a bigger offset pays the loan off sooner.',
        },
        {
          name: 'Stamp duty when an owner moves', value: 'Full rates',
          what: `Charged at the state's standard owner-occupier rates, with thresholds assumed to rise with inflation. In the ACT, which is phasing duty out, it falls in a straight line to nothing over ${ACT_DUTY_PHASE_OUT_YEARS} years. With no state picked, 4% of the home's value.`,
          source: 'Judgment calls: most states don\'t index their thresholds, so real future duty is likely higher; the ACT has published no timetable.',
        },
        {
          name: 'Dividend tax', value: '30% company rate',
          what: 'Dividends are taxed at your income tax rate each year. Franked dividends are grossed up at the 30% company rate and the credit is taken off the tax, with any excess refunded.',
          source: 'ATO.',
        },
        {
          name: 'Share sales', value: 'Average cost',
          what: 'The cost of shares for capital gains tax includes brokerage and reinvested dividends. Under the 2027 rules each purchase is indexed from the month it was made.',
        },
        {
          name: 'Super', value: '15% in, 15% on earnings',
          what: `Salary-sacrificed contributions are taxed 15% on the way in. The fund pays 15% on dividends and on two-thirds of capital gains. Withdrawals are tax-free from age ${SUPER_ACCESS_AGE}; before that the fund's capital gains tax is deducted. Super funds are assumed to keep their one-third discount after July 2027.`,
          source: 'ATO key super rates, 2026–27. The treatment after 2027 is a judgment call. The extra 15% on contributions for incomes over $250k and tax-free earnings in retirement aren\'t modelled.',
        },
        {
          name: 'Age pension', value: `From ${PENSION_AGE}`,
          what: 'Maximum $1,237.70 a fortnight single, $1,866.00 a couple. Reduced by $3 a fortnight for every $1,000 of assets over $333,000 (single homeowner), $499,000 (couple homeowners), $600,000 (single renter) or $766,000 (couple renters); or by 50 cents per dollar of deemed income over $226 (single) or $396 (couple) a fortnight, whichever cuts more. Shares, super and offset cash all count; the home doesn\'t.',
          source: 'Services Australia, read Nov 2026. Rates and limits rise with inflation, a judgment call: pensions usually rise a little faster.',
        },
        {
          name: 'Rent assistance', value: 'Up to $223.80 a fortnight',
          what: 'Renters on the pension get 75 cents per dollar of rent over $157.80 a fortnight (single) or $255.80 (couple), up to $223.80 or $211.00. It is added to the pension before the means tests.',
          source: 'Services Australia, read Nov 2026.',
        },
        {
          name: 'Tax brackets for gradual sales', value: '2027–28 rates',
          what: '14% from $18,200, 30% from $45,000, 37% from $135,000, 45% from $190,000, plus the 2% Medicare levy, less the low income tax offset. Thresholds rise with inflation.',
          source: 'ATO resident rates. Indexing the thresholds is a judgment call: they aren\'t indexed by law.',
        },
      ],
    },
    {
      title: 'The Risk view',
      intro: `Instead of one smooth future, the Risk view runs ${MONTE_CARLO_ITERATIONS.toLocaleString('en-AU')} random ones and counts how often each side wins.`,
      rows: [
        {
          name: 'Long-run averages', value: `±${m.interestRate.longRunStdDev} to ±${m.stockMarketReturn.longRunStdDev} points`,
          what: `Each future first draws its own long-run averages around your inputs: interest rate ±${m.interestRate.longRunStdDev} points, rent growth ±${m.rentIncreaseRate.longRunStdDev}, share return ±${m.stockMarketReturn.longRunStdDev}, property growth ±${m.propertyGrowthRate.longRunStdDev} (one standard deviation).`,
          source: 'Judgment calls about how unsure 30-year averages are.',
        },
        {
          name: 'Year-to-year swings', value: `Shares ±${m.stockMarketReturn.annualStdDev}%, home ±${m.propertyGrowthRate.annualStdDev}%`,
          what: `Each year then varies around that average: shares by the portfolio's volatility (±${m.stockMarketReturn.annualStdDev}% if none is set), one home's value ±${m.propertyGrowthRate.annualStdDev}%, rent growth ±${m.rentIncreaseRate.annualStdDev} points, the mortgage rate ±${m.interestRate.annualStdDev} points, drifting back a quarter of the way to its average each year.`,
          source: 'Rough calibration to Australian history. A single home swings more than a city index (about 4–5%).',
        },
        {
          name: 'How they move together', value: 'Correlated',
          what: `Rates and rent growth ${c[0][1]}, rates and shares ${c[0][2]}, rates and property ${c[0][3]}, rent and property ${c[1][3]}, shares and property ${c[2][3]}, rent and shares ${c[1][2]}.`,
          source: 'The signs follow economic reasoning; the sizes are judgment calls, not estimates from data.',
        },
      ],
    },
  ];
}

const BUY_LEFT_OUT: [string, string][] = [
  ['What you can\'t put a price on', 'Security of staying put, freedom to renovate, or the flexibility of renting. The comparison is money only.'],
  ['The same home', 'Both households live in an equivalent home. In practice people often buy bigger or further out than they would rent.'],
  ['Renovations and big repairs', 'Maintenance is a smooth yearly percentage. A new roof or a special strata levy arrives as one bill.'],
  ['Changing circumstances', 'No job loss, no children, no separation, no upsizing. An owner who moves buys a home of the same value.'],
  ['Refinancing and borrowing against the home', 'The loan runs its term at the chosen rate. Owners don\'t redraw equity to invest.'],
  ['Some tax details', 'The income tax rate is fixed for the whole period. The Medicare levy surcharge, the extra super tax on high incomes and tax-free super earnings in retirement aren\'t modelled.'],
  ['Policy changes', 'Stamp duty, grants, pension rules and tax law are today\'s, including the 2027 capital gains changes already legislated.'],
];

// ---- Property or shares ------------------------------------------------------------------

function investGroups(ip: IpInputs): Group[] {
  const D = DEFAULT_IP;
  const landTaxOf = (x: IpInputs) => money(landTaxToday(x.state, x.price * (x.landShare / 100)));
  return [
    {
      title: 'The property',
      rows: [
        {
          name: 'Type', ...pair(D.kind, ip.kind, (x) => (x === 'new' ? 'New build' : 'Established')),
          what: `From July 2027 only new builds can be negatively geared, and only new builds can choose the 50% capital gains discount when sold. A new build pays stamp duty on the land only, earns no rent while it is built, and grows ${NEW_HOME_GROWTH_DRAG} point a year slower for its first ${NEW_HOME_DRAG_YEARS} years.`,
          source: 'Budget 2026–27 tax explainer; the slower growth is the same judgment call as in Rent or Buy.',
        },
        {
          name: 'State', ...pair(D.state, ip.state, String),
          what: 'Sets investor stamp duty and land tax.',
          source: 'State revenue office schedules for 2026–27.',
        },
        {
          name: 'Price', ...pair(D.price, ip.price, money),
          what: 'The purchase price: land plus building for a new build.',
          source: 'Rough: advertised four-bedroom house-and-land packages in Logan and Moreton Bay were $862k–$891k in Nov 2026. Nobody publishes a median.',
        },
        {
          name: 'Land share', ...pair(D.landShare, ip.landShare, (x) => `${pct(x)} of the price`),
          what: 'Splits the price into land and building. Stamp duty on a new build and land tax are charged on the land; depreciation and maintenance are on the building.',
          source: 'Median vacant lots were $497k–$555k in Logan, Ipswich and Moreton Bay (Oliver Hume, Sep quarter 2026), 52–58% of a package.',
        },
        {
          name: 'Build time', ...pair(D.buildMonths, ip.buildMonths, (x) => `${x} months`),
          what: 'New builds only. The loan is drawn as the build progresses and there is no rent. Interest, council rates and land tax in this time can\'t be claimed against income; they are added to the property\'s cost for capital gains tax instead.',
          source: 'Queensland houses took 7.5 months from start to finish in 2025–26 (ABS Building Activity), plus about 1.5 months from settling the land (rough).',
        },
        {
          name: 'Building cost', ...pair(D.capitalWorksBase, ip.capitalWorksBase, money),
          what: 'Established homes only: the original construction cost, which can be claimed at 2.5% a year if the home was built after September 1987. For a new build the model uses the building\'s share of the price.',
          source: 'Default 0: claim nothing unless you have a depreciation schedule.',
        },
        {
          name: 'Loan', ...pair(D.lvr, ip.lvr, (x) => `${pct(x)} of the price`),
          what: 'The rest is your deposit. Above 80% the lender charges mortgage insurance, which is added to the loan.',
          source: '80% is the most you can borrow without mortgage insurance. 30% of new investor loans are at 80% or more (APRA, June quarter 2026).',
        },
        {
          name: 'Interest rate', ...pair(D.interestRate, ip.interestRate, pct),
          what: 'Held for the whole loan, so a long-run average. Interest is the largest cost, and the largest tax deduction.',
          source: 'The 5.75% long-run owner-occupier rate plus the premium on investor interest-only loans, about 0.4 points (RBA table F6, Sep 2026).',
        },
        {
          name: 'Interest-only years', ...pair(D.ioYears, ip.ioYears, years),
          what: 'You pay only interest for this long (up to 15 years), then principal and interest over what is left of a 30-year term. Zero means principal and interest from the start.',
          source: 'CBA, Westpac and ANZ cap an interest-only period at 5 years. 45% of new investor loans were interest-only (APRA, June quarter 2026).',
        },
        {
          name: 'Price growth', ...pair(D.growth, ip.growth, (x) => `${pct(x)} a year`),
          what: 'How fast the property\'s value rises. The single biggest lever: because most of the price is borrowed, one point of growth moves the result a long way.',
          source: 'The same long-run baseline as Rent or Buy.',
        },
        {
          name: 'Gross yield', ...pair(D.grossYield, ip.grossYield, pct),
          what: 'The first year\'s rent as a share of the property\'s value when it is first let.',
          source: 'Median rent on a new four-bedroom house in Logan was $700 a week (RTA bond data, Sep quarter 2026), 4.2% of an $870k package.',
        },
        {
          name: 'Rent growth', ...pair(D.rentGrowth, ip.rentGrowth, (x) => `${pct(x)} a year`),
          what: 'How fast the rent rises. It decides how quickly the property stops costing you money each month.',
          source: 'Rents in the consumer price index rose 3.1% a year over 30 years (ABS, to Sep quarter 2026).',
        },
      ],
    },
    {
      title: 'Running costs',
      intro: 'Dollar amounts rise with inflation. All of them are tax-deductible once the property is rented.',
      rows: [
        {
          name: 'Management', ...pair(D.management, ip.management, (x) => `${pct(x)} of rent collected`),
          what: 'Agent commission including GST, plus letting fees each time a tenant leaves.',
          source: 'About 8% plus GST in Brisbane, plus a week\'s rent per new tenancy. Queensland landlords averaged 8.2% in 2023–24 (ATO Taxation Statistics).',
        },
        {
          name: 'Vacancy', ...pair(D.vacancy, ip.vacancy, (x) => `${pct(x)} of the year`),
          what: 'Time empty between tenants, when no rent comes in.',
          source: 'Rough: about 1.3 weeks a year. Brisbane\'s vacancy rate was 0.9% (SQM, Sep 2026) but averaged about 3% nationally before 2020.',
        },
        {
          name: 'Insurance', ...pair(D.insurance, ip.insurance, perYear),
          what: 'Landlord building and contents cover.',
          source: 'Average landlord policy for a Queensland house outside the north: $2,529 (Canstar, Mar 2026).',
        },
        {
          name: 'Council and water', ...pair(D.councilRates, ip.councilRates, perYear),
          what: 'Paid by the owner, including while a new build is under construction.',
          source: 'The Brisbane figure used in Rent or Buy.',
        },
        {
          name: 'Strata', ...pair(D.strata, ip.strata, perYear),
          what: 'Body corporate levies for units and townhouses.',
          source: 'Default is a freestanding house.',
        },
        {
          name: 'Land tax', ...pair(D, ip, (x) => `${landTaxOf(x)} this year`),
          what: 'Worked out each year from the state\'s schedule on the land\'s value, assuming this is your only investment land. As the land rises in value it can cross the threshold and start being taxed.',
          source: 'State schedules for 2026–27. South Australia\'s thresholds rise with land values and the ACT\'s charges with inflation; the other states\' thresholds stay fixed, as their laws now stand.',
        },
        {
          name: 'Maintenance', ...pair(D.maintenance, ip.maintenance, (x) => `${pct(x)} of the building's cost a year`),
          what: 'Repairs, rising with inflation.',
          source: 'Queensland landlords claimed about $2,000–$2,600 a property for repairs in 2023–24 (ATO Taxation Statistics). Rough: a new house needs less than an older one.',
        },
        {
          name: 'Fittings', ...pair(D.plant, ip.plant, money),
          what: 'New builds only: carpets, blinds, appliances, hot water and air conditioning, which are written off faster than the building (a quarter of the remaining value each year).',
          source: 'Rough, from quantity surveyors\' first-year estimates for a new house (BMT, Washington Brown).',
        },
        {
          name: 'Purchase costs', ...pair(D.purchaseCosts, ip.purchaseCosts, money),
          what: 'Conveyancing, inspections, loan fees and registration, on top of stamp duty.',
          source: 'Openagent (2024) and Titles Queensland fees (2026–27).',
        },
        {
          name: 'Selling costs', ...pair(D.sellingCosts, ip.sellingCosts, (x) => `${pct(x)} of the sale price`),
          what: 'Agent commission, legal fees and marketing when you sell.',
          source: 'Commission averages 2.42% in Brisbane (Openagent, Oct 2026), plus legal fees and marketing.',
        },
      ],
    },
    {
      title: 'The shares',
      rows: [
        {
          name: 'Total return', ...pair(D.etfReturn, ip.etfReturn, (x) => `${pct(x)} a year`),
          what: 'The fund\'s yearly return including distributions, before the fee and tax. Brokerage is ignored.',
          source: 'Diversified high growth fund (VDHG-style): Vanguard Index Chart 2026 blended with Vanguard\'s forward-looking model.',
        },
        {
          name: 'Fee', ...pair(D.etfFee, ip.etfFee, (x) => `${pct(x)} a year`),
          what: 'Taken off the return each year.',
          source: 'Fund factsheet, Aug 2026.',
        },
        {
          name: 'Distribution yield', ...pair(D.etfYield, ip.etfYield, pct),
          what: 'The part of the return paid out each year and taxed at your marginal rate. The rest is growth, taxed only when sold.',
          source: 'Fund factsheet, Aug 2026.',
        },
        {
          name: 'Franked', ...pair(D.franking, ip.franking, (x) => `${pct(x)} of distributions`),
          what: 'Franked distributions carry a credit for the 30% company tax already paid, which reduces your tax.',
          source: 'Fund factsheet, Aug 2026.',
        },
      ],
    },
    {
      title: 'You and the tax rules',
      rows: [
        {
          name: 'Salary', ...pair(D.salary, ip.salary, money),
          what: 'Sets your tax bracket. Rental profits or losses, distributions and the gain on sale are all taxed on top of it.',
          source: '59% of property investors had taxable incomes of $100k or less in 2023–24 (ATO Taxation Statistics).',
        },
        {
          name: 'Pay rises', ...pair(D.salaryGrowth, ip.salaryGrowth, (x) => `${pct(x)} a year`),
          what: 'Faster than inflation, so you slowly move up the tax brackets.',
          source: 'Wages grow about 3–3.5% a year.',
        },
        {
          name: 'Inflation', ...pair(D.inflation, ip.inflation, (x) => `${pct(x)} a year`),
          what: 'Raises running costs and tax brackets each year, and sets how much of a capital gain is indexed away under the 2027 rules.',
          source: 'Midpoint of the Reserve Bank\'s 2–3% target.',
        },
        {
          name: 'Years shown', ...pair(D.years, ip.years, years),
          what: 'How long the simulation runs. You can pick any sale year within it.',
          source: 'Judgment call: a long hold.',
        },
        {
          name: 'Tax rules', ...pair(D.rules, ip.rules, (x) => (x === 'reform' ? 'From July 2027 (law)' : 'Old rules')),
          what: 'The law from 1 July 2027, or the old rules (50% discount and negative gearing on everything) for comparison.',
          source: 'Budget 2026–27 tax explainer and ATO guidance, June 2026.',
        },
      ],
    },
  ];
}

const INVEST_STEPS: ReactNode[] = [
  <><strong>Two investors start with the same cash:</strong> the deposit, stamp duty and purchase costs. One buys the rental with a loan. The other puts all of it into the share fund.</>,
  <><strong>Each month the property either costs money or pays.</strong> Rent, less running costs, interest and any principal. When it costs money, the shares investor invests the same amount, so both are out of pocket equally. When it pays, the landlord invests the surplus in the same fund.</>,
  <><strong>Each year both pay tax on top of the same salary.</strong> The landlord adds the rental profit or loss, after depreciation. The shares investor adds distributions, with franking credits. Refunds are invested; extra tax is matched by the other side investing the same amount.</>,
  <><strong>At the sale year both sell everything</strong> in one year while still earning the salary: the property less selling costs, the loan and capital gains tax; the shares less capital gains tax. What is left is each investor's net worth.</>,
];

function investBuiltIn(): Group[] {
  return [
    {
      title: 'Rules built into the model',
      intro: 'These can\'t be changed on the page. They are fixed in the code, each with its source.',
      rows: [
        {
          name: 'Stamp duty', value: `${money(stampDutyFor(DEFAULT_IP))} by default`,
          what: 'Investor (general) rates, with no home-buyer concessions. On a house-and-land package it is charged on the land contract only.',
          source: 'State schedules for 2026–27.',
        },
        {
          name: 'Negative gearing', value: 'New builds only from July 2027',
          what: 'A rental loss on a new build reduces the tax on your salary. On an established home, losses after 1 July 2027 can only be used against rental profits and the gain on sale, so they wait, sometimes for years. Before that date they are deductible as now.',
          source: 'Budget 2026–27 tax explainer; ATO, June 2026.',
        },
        {
          name: 'Capital gains tax', value: `Indexed, ${MINIMUM_GAIN_TAX * 100}% minimum`,
          what: `Gains made before 1 July 2027 keep the 50% discount. After that the cost is adjusted for inflation and the real gain is taxed at your marginal rate, but no less than ${MINIMUM_GAIN_TAX * 100}%. This applies to shares too. A new build can use the 50% discount instead; the model picks whichever costs less tax.`,
          source: 'Budget 2026–27 tax explainer; ATO, June 2026. Judgment calls where the explainer is silent: purchase costs are indexed, depreciation already claimed is added back at the amount claimed, and indexation can cancel a gain but not create a loss.',
        },
        {
          name: 'Depreciation', value: '2.5% a year on the building',
          what: 'The building\'s construction cost is claimed at 2.5% a year. Fittings in a new build are claimed at a quarter of their remaining value each year. Both reduce tax now and increase the taxable gain when you sell. Second-hand fittings in an established home can\'t be claimed.',
          source: 'ATO capital works and depreciation rules. The eight-year average life of fittings is rough.',
        },
        {
          name: 'Loan term', value: '30 years',
          what: 'After any interest-only period, repayments clear the loan over what is left of 30 years.',
          source: 'The standard Australian loan term.',
        },
        {
          name: 'Mortgage insurance', value: 'Over 80% only',
          what: '1% of the loan up to 85%, 2% up to 90%, 3.5% up to 95% and 4.5% above, added to the loan. Investors can\'t use the 5% Deposit Scheme.',
          source: 'Rough: the same estimate as Rent or Buy.',
        },
        {
          name: 'Construction', value: 'No rent until it is built',
          what: 'The land is paid for up front and the build is drawn evenly over the build time, with interest only on what has been drawn.',
        },
        {
          name: 'Income tax', value: '2027–28 rates',
          what: '14% from $18,200, 30% from $45,000, 37% from $135,000, 45% from $190,000, plus the 2% Medicare levy, less the low income tax offset. Thresholds rise with inflation.',
          source: 'ATO resident rates. Indexing the thresholds is a judgment call: they aren\'t indexed by law.',
        },
        {
          name: 'Steps', value: 'Monthly',
          what: 'Cash flows are monthly. Tax is settled once a year, when salary also steps up. Rent rises once a year, on the anniversary of the first letting. Land tax is assessed once a year.',
        },
      ],
    },
  ];
}

const INVEST_LEFT_OUT: [string, string][] = [
  ['Risk', 'Both sides grow smoothly. In reality one property in one suburb, mostly bought with borrowed money, can swing much further than a fund of thousands of companies.'],
  ['Your time', 'Tenants, repairs and paperwork take hours. Shares take none.'],
  ['Selling in retirement', 'Both sell in one year on top of a full salary. Selling slowly after you stop working would mean less tax for both, and the pension exemption from the 30% minimum isn\'t modelled here.'],
  ['Resale of a new build', 'The second owner of a new build loses negative gearing and the discount, which may lower what they will pay. That isn\'t modelled beyond the slower early growth.'],
  ['Lumpy costs', 'No special levies, major repairs or rate rises. Mortgage insurance isn\'t claimed as a deduction.'],
  ['A second property', 'Land tax assumes this is your only investment land. A second one shares the threshold and pays much more.'],
  ['Borrowing to buy shares', 'The shares investor uses only their own cash. A geared share portfolio would be the closer match to a geared property.'],
];

// ---- Page --------------------------------------------------------------------------------

export default function ModelGuide({ tab, onTabChange, buy, ip, onOpenCalculator }: {
  tab: GuideTab;
  onTabChange: (tab: GuideTab) => void;
  buy: BuyValues;
  ip: IpInputs;
  onOpenCalculator: (tab: GuideTab) => void;
}) {
  const isBuy = tab === 'buy';
  const groups = isBuy ? buyGroups(buy) : investGroups(ip);
  const builtIn = isBuy ? buyBuiltIn() : investBuiltIn();
  const changed = groups.reduce((n, g) => n + g.rows.filter((r) => r.yours).length, 0);
  const name = isBuy ? 'Rent or Buy' : 'Property or Shares';

  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-12 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <section aria-label="About this page" className="flex max-w-3xl flex-col gap-4">
        <span className="eyebrow">How it works</span>
        <h1 className="m-0 text-4xl leading-none font-bold tracking-tighter sm:text-6xl">Every assumption, in the open</h1>
        <p className="m-0 text-lg leading-relaxed text-ink-2">
          Each calculator is a simulation with a few dozen inputs and a handful of fixed rules. This page lists all of them: what
          each one does, its default, and where the default comes from. Figures marked rough or judgment call are estimates, not
          data.
        </p>
        <div className="w-fit">
          <Segmented label="Calculator" value={tab} onChange={onTabChange}
            options={[{ value: 'buy', label: 'Rent or Buy' }, { value: 'invest', label: 'Property or Shares' }]} />
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <Heading eyebrow="1 · The method" title={isBuy ? 'Two households, the same budget' : 'Two investors, the same budget'}>
          {isBuy
            ? 'The model follows a buyer and a renter who start with the same money and spend the same amount every month, then compares what each is worth.'
            : 'The model follows a landlord and a share investor who start with the same money and put in the same amount every month, then compares what each is worth.'}
        </Heading>
        <Steps steps={isBuy ? BUY_STEPS : INVEST_STEPS} />
      </section>

      <section className="flex flex-col gap-5">
        <Heading eyebrow="2 · The inputs" title="What you can change">
          Defaults are shown under each name.{' '}
          {changed > 0
            ? `You have changed ${changed} of them in ${name}; your values are marked.`
            : `You haven't changed any in ${name}.`}
        </Heading>
        {groups.map((g) => <Rows key={g.title} group={g} />)}
      </section>

      <section className="flex flex-col gap-5">
        <Heading eyebrow="3 · The fixed parts" title="What is built in" />
        {builtIn.map((g) => <Rows key={g.title} group={g} />)}
      </section>

      <section className="flex flex-col gap-5">
        <Heading eyebrow="4 · The limits" title="What it leaves out">
          No model covers everything. These are the things most likely to matter that this one ignores.
        </Heading>
        <LeftOut items={isBuy ? BUY_LEFT_OUT : INVEST_LEFT_OUT} />
      </section>

      <section className="flex max-w-3xl flex-col gap-4">
        <p className="m-0 text-[15px] leading-relaxed text-ink-2">
          The models are tested against published examples (the Budget's tax explainer, state revenue office duty and land tax
          examples, Services Australia pension figures) and against identities that must hold, such as the gap between the two
          sides adding up line by line. The code is public at{' '}
          <a href="https://github.com/dashdotme/au-capital-calc" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">GitHub</a>.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onOpenCalculator(tab)} className="min-h-12 rounded-xl bg-ink px-5 text-[15px] font-semibold text-ground">
            Open {name}
          </button>
          <button type="button" onClick={() => onTabChange(isBuy ? 'invest' : 'buy')} className="min-h-12 rounded-xl border border-line-strong bg-surface px-5 text-[15px] font-semibold">
            See {isBuy ? 'Property or Shares' : 'Rent or Buy'} assumptions
          </button>
        </div>
      </section>
    </main>
  );
}
