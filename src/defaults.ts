import type { InvestmentInputs, PropertyInputs, RentInputs } from './types';
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
  },
  defaultPortfolio
);

/** Matches the loan term, so the default shows the whole loan */
export const DEFAULT_HORIZON = 30;
/** Enough paths that the win probability moves by under about 1 point between runs */
export const MONTE_CARLO_ITERATIONS = 5000;
