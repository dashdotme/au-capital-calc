import type { InvestmentInputs, PropertyInputs, RentInputs } from './types';
import { PORTFOLIOS, applyPortfolio } from './portfolios';
import { CITIES, applyCity } from './cities';

// Defaults start from a median Brisbane dwelling (Cotality HVI, Sep 2026) and a global
// shares portfolio. Rates from RBA F5/F6, Sep 2026.

const BASE_PROPERTY: PropertyInputs = {
  propertyPrice: 975000,
  deposit: 195000,
  loanTerm: 30,
  // New owner-occupier variable loans ~6.2% (Aug 2026); 30-yr average of the RBA
  // discounted variable rate 5.79%. Scenarios are long-run averages, not today's rate.
  interestRate: { pessimistic: 7.0, baseline: 5.75, optimistic: 4.5 },
  stampDuty: 40000,
  otherPurchaseCosts: 7000,
  maintenanceRate: 1.0,
  councilRates: 3100,
  buildingInsurance: 2000,
  contentsInsurance: 450,
  sellingCostRate: 3.0,
  capitalGainsTaxRate: 0,
  offsetAccountBalance: 50000,
  lmi: 0,
};

const BASE_RENT: RentInputs = {
  monthlyRent: 3000,
  rentIncreaseRate: { pessimistic: 5.0, baseline: 3.5, optimistic: 2.5 },
  movingFrequency: 3,
  movingCost: 2500,
  contentsInsurance: 450, // same contents as the owner
};

const defaultCity = CITIES.find((c) => c.id === 'brisbane')!;
const defaultPortfolio = PORTFOLIOS.find((p) => p.id === 'global')!;

// Brisbane fills price, 20% deposit, QLD home-concession stamp duty, rent, rates and insurance
export const [DEFAULT_PROPERTY, DEFAULT_RENT] = applyCity(BASE_PROPERTY, BASE_RENT, defaultCity);

export const DEFAULT_INVESTMENT: InvestmentInputs = applyPortfolio(
  {
    stockMarketReturn: 0,
    propertyGrowthRate: { pessimistic: 3.0, baseline: 4.0, optimistic: 5.5 },
    marginalTaxRate: 39,
    inflationRate: 2.5,
    stockTransactionCost: 0.1,
    dividendReinvestment: true,
  },
  defaultPortfolio
);

export const DEFAULT_HORIZON = 30;
export const MONTE_CARLO_ITERATIONS = 5000;
