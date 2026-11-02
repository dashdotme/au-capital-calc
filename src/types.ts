export interface ScenarioValue {
  pessimistic: number;
  baseline: number;
  optimistic: number;
}

import type { AuState } from './utils/stampDuty';

export interface PropertyInputs {
  propertyPrice: number;
  deposit: number;
  loanTerm: number;
  interestRate: number | ScenarioValue;
  /** Calculated from price, state and buyer type when `state` is set; otherwise entered by hand */
  stampDuty: number;
  /** State whose stamp duty rules apply; unset means the stamp duty figure is manual */
  state?: AuState;
  firstHomeBuyer?: boolean;
  /** Never lived in; changes first home buyer stamp duty in some states and unlocks grants */
  newHome?: boolean;
  /** First home owner grant, derived from state, price and buyer; reduces the cash needed upfront */
  firstHomeGrant?: number;
  otherPurchaseCosts: number;
  maintenanceRate: number;
  councilRates: number;
  buildingInsurance: number;
  contentsInsurance: number;
  sellingCostRate: number;
  capitalGainsTaxRate: number;
  offsetAccountBalance?: number;
  /** Strata (body corporate) levies per year in today's dollars; 0 for a freestanding house */
  strataLevies?: number;
  /**
   * Years between owner moves; 0 = stay put until selling. Each move sells and buys a home of
   * the same value: selling costs, stamp duty (not first-home rates), other purchase costs
   * and removalists.
   */
  ownerMoveFrequency?: number;
  /** Lenders mortgage insurance, capitalised into the loan (typically only when LVR > 80%) */
  lmi?: number;
  /** Estimate LMI from LVR and the 5% Deposit Scheme instead of using the figure entered */
  lmiEstimated?: boolean;
  /** Id of the city preset these values came from, if any */
  location?: string;
}

export interface RentInputs {
  monthlyRent: number;
  rentIncreaseRate: number | ScenarioValue;
  movingFrequency: number;
  movingCost: number;
  contentsInsurance: number;
}

export interface InvestmentInputs {
  /** Total return including dividends; price growth is this minus dividendYield */
  stockMarketReturn: number | ScenarioValue;
  propertyGrowthRate: number | ScenarioValue;
  /** Marginal rate including the Medicare levy */
  marginalTaxRate: number;
  inflationRate: number;
  stockTransactionCost: number;
  dividendYield?: number;
  frankingLevel?: number;
  dividendReinvestment?: boolean;
  /** Annual fund management fee (MER), % of balance; deducted from the total return */
  managementFee?: number;
  /**
   * Share (%) of each month's housing saving that the cheaper household invests; the rest is
   * spent. 100 is the textbook assumption that the renter invests every dollar of the difference.
   */
  investedShare?: number;
  /** Year-to-year volatility of the portfolio's returns (%), used by Monte Carlo */
  stockVolatility?: number;
  /** Id of the portfolio preset these values came from, if any */
  portfolio?: string;
  /**
   * Whether the buyer's spare cash fills the offset (up to the loan balance) before buying
   * shares; default true
   */
  buyerSurplusToOffset?: boolean;
  /** Age today; with `couple`, drives the age pension and when super contributions stop */
  age?: number;
  /** Two adults (pension and rent assistance at couple rates, gains split between two people) */
  couple?: boolean;
  /** Share (%) of each month's invested saving salary-sacrificed into super instead of shares */
  superShare?: number;
  /** Unused concessional cap room per year for the household, today's dollars (pre-tax) */
  superCapRoom?: number;
  /**
   * Sell shares gradually instead of all at once at the marginal rate: the gain is spread
   * over `saleYears` and taxed through the brackets on top of `saleIncome` per person.
   */
  spreadSale?: boolean;
  saleYears?: number;
  /** Other taxable income per person in each year of selling, today's dollars */
  saleIncome?: number;
}

/**
 * End-of-year state of both households. Both start with the same capital and spend the
 * same amount each month; whichever strategy is cheaper that month invests the difference.
 * "Net position" values are therefore directly comparable net worths.
 */
export interface YearlySnapshot {
  year: number;
  /** Property value minus loan balance */
  mortgageEquity: number;
  /** Upfront purchase costs plus principal and interest repaid */
  mortgageTotalPaid: number;
  mortgagePropertyValue: number;
  mortgageLoanBalance: number;
  /** Buyer's side portfolio, funded in months where owning is cheaper than renting */
  mortgageInvestmentValue: number;
  /** Buyer net worth before selling costs and taxes */
  mortgageNetPosition: number;
  /** Buyer net worth after selling the property and liquidating investments */
  mortgageNetPositionAfterSale: number;
  mortgageMaintenance: number;
  mortgageRates: number;
  mortgageInsurance: number;
  mortgageTotalInterest: number;
  /** Buyer cash outflow for housing during this year */
  mortgageAnnualCost: number;
  /** Cumulative new savings the buyer has invested (excludes reinvested dividends) */
  mortgageContributions: number;
  /** Selling costs plus CGT if the home were sold this year */
  mortgageSaleCosts: number;
  /** Cumulative strata levies */
  mortgageStrata: number;
  /** Cumulative cost of owner moves: selling costs, stamp duty, purchase costs, removalists, CGT */
  mortgageMoveCosts: number;
  /** Buyer's super built from salary-sacrificed savings (before any exit tax) */
  mortgageSuperValue: number;
  /** Cumulative age pension received by the buyer */
  mortgagePension: number;
  /** Cumulative monthly savings the buyer spent instead of investing (see `investedShare`) */
  mortgageSpent: number;
  rentTotalPaid: number;
  rentMovingCosts: number;
  rentInsurance: number;
  rentInvestmentValue: number;
  /** Renter's super built from salary-sacrificed savings (before any exit tax) */
  rentSuperValue: number;
  /** Cumulative age pension and rent assistance received by the renter */
  rentPension: number;
  /** Renter net worth before selling costs and taxes */
  rentNetPosition: number;
  /** Renter net worth after liquidating investments and paying CGT */
  rentNetPositionAfterTax: number;
  /** Cumulative after-tax dividends (including franking refunds) */
  rentDividends: number;
  rentFrankingCredits: number;
  /** Renter cash outflow for housing during this year */
  rentAnnualCost: number;
  /** Cumulative new savings the renter has invested, including the starting capital */
  rentContributions: number;
  /** Cumulative monthly savings the renter spent instead of investing (see `investedShare`) */
  rentSpent: number;
}

export interface ScenarioResults {
  pessimistic: YearlySnapshot[];
  baseline: YearlySnapshot[];
  optimistic: YearlySnapshot[];
}

export interface BreakEvenResult {
  metricKey: string;
  metric: string;
  currentValue: number;
  breakEvenValue: number | null;
  exists: boolean;
  currentFavorsBuy: boolean;
  interpretation: string;
}

export interface BreakEvenResults {
  results: BreakEvenResult[];
  timeHorizon: number;
}

export interface MonteCarloResults {
  iterations: number;
  rentBetterProbability: number;
  buyBetterProbability: number;
  expectedAdvantage: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  histogram: {
    binStart: number;
    binEnd: number;
    count: number;
    probability: number;
  }[];
  timeSeriesPercentiles: {
    year: number;
    rentP10: number;
    rentP50: number;
    rentP90: number;
    buyP10: number;
    buyP50: number;
    buyP90: number;
    buyBetterProbability: number;
  }[];
  allOutcomes: number[];
}
