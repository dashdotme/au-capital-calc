export interface ScenarioValue {
  pessimistic: number;
  baseline: number;
  optimistic: number;
}

export interface PropertyInputs {
  propertyPrice: number;
  deposit: number;
  loanTerm: number;
  interestRate: number | ScenarioValue;
  stampDuty: number;
  otherPurchaseCosts: number;
  maintenanceRate: number;
  councilRates: number;
  buildingInsurance: number;
  contentsInsurance: number;
  sellingCostRate: number;
  capitalGainsTaxRate: number;
  offsetAccountBalance?: number;
  /** Lenders mortgage insurance, capitalised into the loan (typically only when LVR > 80%) */
  lmi?: number;
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
  /** Year-to-year volatility of the portfolio's returns (%), used by Monte Carlo */
  stockVolatility?: number;
  /** Id of the portfolio preset these values came from, if any */
  portfolio?: string;
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
  rentTotalPaid: number;
  rentMovingCosts: number;
  rentInsurance: number;
  rentInvestmentValue: number;
  /** Renter net worth before selling costs and taxes */
  rentNetPosition: number;
  /** Renter net worth after liquidating investments and paying CGT */
  rentNetPositionAfterTax: number;
  /** Cumulative after-tax dividends (including franking refunds) */
  rentDividends: number;
  rentFrankingCredits: number;
  /** Renter cash outflow for housing during this year */
  rentAnnualCost: number;
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
