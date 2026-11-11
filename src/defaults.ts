import type { InvestmentInputs, PropertyInputs, RentInputs } from './types';
import type { IpInputs } from './utils/investmentProperty';
import { monthsUntilReform } from './utils/investmentProperty';
import { PORTFOLIOS, applyPortfolio } from './portfolios';
import { CITIES, applyCity } from './cities';

// Defaults start from a median Brisbane dwelling (Cotality HVI, Sep 2026) and a global
// shares portfolio. Rates from RBA F5/F6, Sep 2026. Price, deposit, stamp duty, rent, council
// rates and building insurance below are placeholders that applyCity replaces (see cities.ts).
// Figures marked "rough" are round-number judgment calls, not taken from a source.

const BASE_PROPERTY: PropertyInputs = {
  propertyPrice: 975000,
  deposit: 195000,
  loanTerm: 30, // the standard Australian home loan term
  // New owner-occupier variable loans ~6.2% (Aug 2026); 30-yr average of the RBA
  // discounted variable rate 5.79%. Scenarios are long-run averages, not today's rate.
  interestRate: { pessimistic: 7.0, baseline: 5.75, optimistic: 4.5 },
  stampDuty: 40000,
  // Someone comparing renting with buying usually hasn't bought before
  firstHomeBuyer: true,
  newHome: false,
  firstHomeGrant: 0,
  // Rough: conveyancing (~$2k), building and pest inspection (~$600), loan and mortgage
  // registration fees (~$1k) and moving in (~$2–3k)
  otherPurchaseCosts: 7000,
  // Rough: the common 1%-of-value-a-year rule of thumb for upkeep (1–2% is often quoted).
  // Apartments pay strata on top, entered separately below.
  maintenanceRate: 1.0,
  // A freestanding house. Rough, from industry guides (no official dataset): small walk-up
  // blocks ~$2–5k a year, high-rises with lifts and amenities $8k+
  strataLevies: 0,
  councilRates: 3100,
  buildingInsurance: 2000,
  contentsInsurance: 450, // rough: a basic contents policy
  // Rough: agent commission (~2–2.5% in capitals) plus marketing and conveyancing
  sellingCostRate: 3.0,
  capitalGainsTaxRate: 0, // a main residence is exempt from CGT
  // Years between owner moves (0 = stays put until selling). Sellers had held houses ~9 years
  // and units ~8 (Domain, 1H 2025); profitable house resales had a median hold of 9.3 years
  // (Cotality Pain and Gain, June quarter 2026).
  ownerMoveFrequency: 9,
  // Rough: a modest emergency buffer kept in the offset; both households start with it
  offsetAccountBalance: 50000,
  lmi: 0, // estimated from the deposit by withPurchaseCosts
  lmiEstimated: true,
};

const BASE_RENT: RentInputs = {
  monthlyRent: 3000,
  // Rents track incomes over the long run (wages ~3–3.5% a year, see HomeGrowthSources); the
  // 2021–24 post-pandemic surge (often 5–10% a year) isn't treated as a trend
  rentIncreaseRate: { pessimistic: 5.0, baseline: 3.5, optimistic: 2.5 },
  // Rough: many leases run 12 months, but renters typically stay a few years per home
  movingFrequency: 3,
  // Rough: removalists, cleaning, connections and overlapping rent for a local move
  movingCost: 2500,
  contentsInsurance: 450, // same contents as the owner
};

const defaultCity = CITIES.find((c) => c.id === 'brisbane')!;
const defaultPortfolio = PORTFOLIOS.find((p) => p.id === 'global')!;

// Brisbane fills price, 20% deposit, QLD stamp duty, rent, rates and insurance
export const [DEFAULT_PROPERTY, DEFAULT_RENT] = applyCity(BASE_PROPERTY, BASE_RENT, defaultCity);

export const DEFAULT_INVESTMENT: InvestmentInputs = applyPortfolio(
  {
    stockMarketReturn: 0,
    // Long-run nominal averages: incomes grow ~3–3.5%, and the 1990–2021 fall in rates won't repeat.
    // See HomeGrowthSources for the reasoning and sources.
    propertyGrowthRate: { pessimistic: 2.5, baseline: 4.0, optimistic: 5.0 },
    // 37% bracket ($135k–$190k, stage 3, 2024–25 onward) plus the 2% Medicare levy
    marginalTaxRate: 39,
    // Midpoint of the RBA's 2–3% target band
    inflationRate: 2.5,
    // Rough: brokerage on regular monthly buys (e.g. a few dollars per trade, or 0.1% at
    // percentage-based brokers)
    stockTransactionCost: 0.1,
    dividendReinvestment: true,
    investedShare: 100,
    // Cash in an offset earns the mortgage rate risk-free and untaxed (a 5.75% loan is worth
    // ~9.4% pre-tax at the 39% rate), the usual choice while a loan is outstanding
    buyerSurplusToOffset: true,
    // Mean first home buyer age for an established home, ABS Survey of Income and Housing
    // 2017–18 (via AHURI, "When are Australians buying their first home"), the latest official
    // figure; surveys since put it in the low-to-mid 30s
    age: 36,
    couple: true,
    superShare: 0,
    // Rough: two earners on half the Brisbane median household income (~$56.5k each) have the
    // $32,500 concessional cap (2026–27) less ~$6.8k employer super (12%) each
    superCapRoom: 51000,
    spreadSale: false,
    // Judgment call, used only when spreading is switched on: selling down over a decade of
    // retirement with no other taxable income
    saleYears: 10,
    saleIncome: 0,
    // Law from 1 Jul 2027 (2026–27 Budget; see utils/cgtReform.ts): CPI indexation and a 30%
    // minimum tax on shares' real gains, the 50% discount kept for gains before then
    cgtRules: 'reform',
  },
  defaultPortfolio
);

/** Matches the loan term, so the default shows the whole loan */
export const DEFAULT_HORIZON = 30;
/** Enough paths that the win probability moves by under about 1 point between runs */
export const MONTE_CARLO_ITERATIONS = 5000;

const ipPortfolio = PORTFOLIOS.find((p) => p.id === 'high-growth')!;

// Investment property vs shares. A new house-and-land in Brisbane's growth areas (Logan,
// Ipswich, Moreton Bay), since only new builds keep negative gearing after 1 Jul 2027. Read
// 7 Nov 2026; figures marked rough are judgment calls.
export const DEFAULT_IP: IpInputs = {
  kind: 'new',
  state: 'QLD',
  // Rough: no one publishes a median package price. Advertised 4-bed packages: Flagstone (Logan)
  // $862k, Everleigh (Logan) $891k, North Harbour (Moreton Bay) $886k (Real Estate Investors
  // Network, Nov 2026)
  price: 870000,
  // Median vacant lots, Sep qtr 2026: Logan $497k, Ipswich $542k, Moreton Bay $555k (Oliver Hume
  // via The Urban Developer, 30 Oct 2026), so land is 52–58% of a package
  landShare: 55,
  // QLD houses took 2.52 quarters (7.5 months) from start to finish in 2025–26 (ABS Building
  // Activity, Jun 2026); rough: plus about 1.5 months from land settlement to the slab
  buildMonths: 9,
  // The most you can borrow without lenders mortgage insurance, and the usual choice: 30% of
  // new investor loans are at 80% LVR or more, 3.4% at 90% or more (APRA QPEX, Jun qtr 2026)
  lvr: 80,
  // The app's 5.75% long-run owner-occupier rate plus the investor interest-only premium: new
  // investor IO loans 6.5% vs new owner-occupier P&I loans 6.1% (RBA F6, Sep 2026), a 0.3–0.4
  // point gap throughout 2025–26
  interestRate: 6.15,
  // CBA, Westpac and ANZ all cap an interest-only period at 5 years at a time (investors can
  // renew, to 10–15 years in total), then switch to P&I over the rest of the term (lender pages,
  // read 7 Nov 2026). 45% of new investor loans were interest-only (APRA QPEX, Jun qtr 2026).
  ioYears: 5,
  // Same long-run baseline as the rent-or-buy defaults; see HomeGrowthSources
  growth: 4,
  // Median new-bond rent for a 4-bed house, Sep qtr 2026: Logan $700 a week, Moreton Bay $710
  // (RTA bond statistics). $700 × 52 on an $870k package is 4.2%. Brisbane houses overall yield
  // 3.3% (Cotality HVI, Sep 2026): fringe houses are cheaper relative to their rent.
  grossYield: 4.2,
  // Rents track incomes, as in the rent-or-buy defaults. CPI rents rose 3.1% a year over 30
  // years and 3.3% over 20 (ABS CPI 115522, to Sep qtr 2026); fringe 4-bed bond rents rose
  // 4.3–4.9% a year 2012–2026, but only 0.4–1.8% a year 2012–2019 before the surge (RTA).
  rentGrowth: 3.5,
  // All agent fees as a share of rent collected: about 8% plus GST commission (Brisbane 7.3–9%,
  // LocalAgentFinder and WhichRealEstateAgent 2026) plus a week's rent to let it each time a
  // tenant leaves (houses' median tenancy is 21.8 months, RTA Annual Report 2024–25), about
  // 0.6 points more. Landlords' agent fees averaged 8.2% of gross rent in QLD in 2023–24, self-
  // managers included (ATO Taxation Statistics, Table 26).
  management: 9.5,
  // Rough: 1.3 weeks a year empty. Brisbane's vacancy rate is 0.9% today (SQM, Sep 2026), but a
  // "healthy" market is 2.6–3.5% (REIQ) and the national rate averaged 3.3% the decade before
  // COVID (Cotality); 2–3 weeks between tenants every 21.8 months is 1.1–1.7 weeks a year.
  vacancy: 2.5,
  // Average landlord insurance (building and contents, $1,000 excess) for a house in QLD
  // outside the north: $2,529 (Canstar, Mar 2026)
  insurance: 2500,
  // Brisbane council and water (cities.ts); fringe councils are similar
  councilRates: 3000,
  strata: 0,
  // 0.5% of a $390k building is about $2k a year. QLD landlords claimed $1,322 a year per owner's
  // share of a property for repairs (ATO Taxation Statistics 2023–24, Table 26), roughly $2–2.6k
  // a property; rough: a new house needs less than the 1% rule used for owner-occupied homes.
  maintenance: 0.5,
  capitalWorksBase: 0,
  // Rough: carpets, blinds, appliances, hot water and air conditioning. Quantity surveyors put a
  // new house's first-year claim at $12–15.5k (BMT; Washington Brown: about $13k on a $500k
  // house); capital works on the $375k of building that isn't fittings is $9.4k, leaving about
  // $4k of fittings in year one, a quarter of $16k at the diminishing value rate.
  plant: 16000,
  // Conveyancing ~$1.5k, inspections ~$500, loan fees ~$400 (Openagent, 2024), transfer
  // registration on the land ~$1.7k and the mortgage $248 (Titles Queensland fees, 2026–27)
  purchaseCosts: 4500,
  // Agent commission averages 2.42% incl. GST in Brisbane (Openagent, Oct 2026), plus legal fees
  // ($0.9–1.9k) and marketing (rough: $3–6k)
  sellingCosts: 3,
  // Diversified high growth (VDHG-style), from portfolios.ts
  etfReturn: ipPortfolio.returns.baseline,
  etfFee: ipPortfolio.managementFee,
  etfYield: ipPortfolio.dividendYield,
  franking: ipPortfolio.frankingLevel,
  // 58.8% of property investors had taxable incomes of $100k or less in 2023–24 and 39.5%
  // $100k–500k (ATO Taxation Statistics, Table 27B), so $100k sits in the middle
  salary: 100000,
  // Wages grow about 3–3.5% a year (see the rent-or-buy defaults)
  salaryGrowth: 3.25,
  // Midpoint of the RBA's 2–3% target band, as in rent-or-buy
  inflation: 2.5,
  // Judgment call: a long hold; pick any year on the chart
  years: 20,
  rules: 'reform',
  monthsToReform: monthsUntilReform(new Date()),
};
