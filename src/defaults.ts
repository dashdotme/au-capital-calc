import type { InvestmentInputs, PropertyInputs, RentInputs } from './types';
import { PORTFOLIOS, applyPortfolio } from './portfolios';

// Defaults describe a typical combined-capitals dwelling as of Sep 2026 (Cotality HVI
// median $973,525, gross yield 3.70%). Rates from RBA F5/F6, Sep 2026.

export const DEFAULT_PROPERTY: PropertyInputs = {
  propertyPrice: 975000,
  deposit: 195000, // 20%, so no LMI
  loanTerm: 30,
  // New owner-occupier variable loans ~6.2% (Aug 2026); 30-yr average of the RBA
  // discounted variable rate 5.79%. Scenarios are long-run averages, not today's rate.
  interestRate: { pessimistic: 7.0, baseline: 5.75, optimistic: 4.5 },
  // Blend of NSW (~$38k), VIC (~$54k) and QLD home concession (~$30k) at $975k
  stampDuty: 40000,
  otherPurchaseCosts: 7000,
  maintenanceRate: 1.0,
  councilRates: 3100, // ~$2,200 council rates plus ~$900 fixed water and sewerage
  buildingInsurance: 2000,
  contentsInsurance: 450,
  sellingCostRate: 3.0,
  capitalGainsTaxRate: 0,
  offsetAccountBalance: 50000,
  lmi: 0,
};

export const DEFAULT_RENT: RentInputs = {
  monthlyRent: 3000, // 3.70% gross yield on $975k ≈ $693/week
  rentIncreaseRate: { pessimistic: 5.0, baseline: 3.5, optimistic: 2.5 },
  movingFrequency: 3,
  movingCost: 2500,
  contentsInsurance: 450, // same contents as the owner
};

export const DEFAULT_INVESTMENT: InvestmentInputs = applyPortfolio(
  {
    stockMarketReturn: 0,
    propertyGrowthRate: { pessimistic: 3.0, baseline: 4.0, optimistic: 5.5 },
    marginalTaxRate: 39,
    inflationRate: 2.5,
    stockTransactionCost: 0.1,
    dividendReinvestment: true,
  },
  PORTFOLIOS[0]
);

export const DEFAULT_HORIZON = 30;
export const MONTE_CARLO_ITERATIONS = 5000;
