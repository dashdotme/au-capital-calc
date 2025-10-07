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
}

export interface RentInputs {
  monthlyRent: number;
  rentIncreaseRate: number | ScenarioValue;
  movingFrequency: number;
  movingCost: number;
  contentsInsurance: number;
}

export interface InvestmentInputs {
  stockMarketReturn: number | ScenarioValue;
  propertyGrowthRate: number | ScenarioValue;
  marginalTaxRate: number;
  inflationRate: number;
  stockTransactionCost: number;
  dividendYield?: number;
  frankingLevel?: number;
  dividendReinvestment?: boolean;
}

export interface YearlySnapshot {
  year: number;
  mortgageEquity: number;
  mortgageTotalPaid: number;
  mortgagePropertyValue: number;
  mortgageNetPosition: number;
  mortgageNetPositionAfterSale: number;
  mortgageMaintenance: number;
  mortgageRates: number;
  mortgageInsurance: number;
  mortgageTotalInterest: number;
  rentTotalPaid: number;
  rentMovingCosts: number;
  rentInsurance: number;
  rentInvestmentValue: number;
  rentNetPosition: number;
  rentNetPositionAfterTax: number;
  rentDividends: number;
  rentFrankingCredits: number;
}

export interface ScenarioResults {
  pessimistic: YearlySnapshot[];
  baseline: YearlySnapshot[];
  optimistic: YearlySnapshot[];
}

export interface BreakEvenResult {
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
  }[];
  allOutcomes: number[];
}
