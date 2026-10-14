import { describe, expect, it } from 'vitest';
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import {
  calculateMortgagePayment,
  findBuyCrossoverYear,
  runComparison,
  toRealTerms,
} from './calculations';
import { calculateBreakEven } from './breakeven';
import { DEFAULT_CORRELATION_MATRIX, cholesky } from './distributions';
import { runMonteCarloSimulation } from './monteCarlo';

const property: PropertyInputs = {
  propertyPrice: 900000,
  deposit: 180000,
  loanTerm: 30,
  interestRate: 5.5,
  stampDuty: 30000,
  otherPurchaseCosts: 10000,
  maintenanceRate: 1,
  councilRates: 2500,
  buildingInsurance: 1400,
  contentsInsurance: 1000,
  sellingCostRate: 3,
  capitalGainsTaxRate: 0,
  offsetAccountBalance: 0,
};

const rent: RentInputs = {
  monthlyRent: 3000,
  rentIncreaseRate: 3,
  movingFrequency: 3,
  movingCost: 2000,
  contentsInsurance: 1200,
};

const investment: InvestmentInputs = {
  stockMarketReturn: 8,
  propertyGrowthRate: 4.5,
  marginalTaxRate: 39,
  inflationRate: 2.5,
  stockTransactionCost: 0.1,
  dividendYield: 1.5,
  frankingLevel: 0,
  dividendReinvestment: true,
};

/** A world with no growth, costs, fees or taxes, where only cash flows matter. */
const frictionless = {
  property: {
    ...property,
    interestRate: 0,
    stampDuty: 0,
    otherPurchaseCosts: 0,
    maintenanceRate: 0,
    councilRates: 0,
    buildingInsurance: 0,
    contentsInsurance: 0,
    sellingCostRate: 0,
  },
  rent: { ...rent, monthlyRent: 0, rentIncreaseRate: 0, movingCost: 0, contentsInsurance: 0 },
  investment: {
    ...investment,
    stockMarketReturn: 0,
    propertyGrowthRate: 0,
    marginalTaxRate: 0,
    stockTransactionCost: 0,
    dividendYield: 0,
  },
};

const last = <T,>(xs: T[]) => xs[xs.length - 1];

describe('calculateMortgagePayment', () => {
  it('handles a zero interest rate', () => {
    expect(calculateMortgagePayment(360000, 0, 30)).toBeCloseTo(1000);
  });

  it('matches the standard annuity formula', () => {
    expect(calculateMortgagePayment(720000, 5.5, 30)).toBeCloseTo(4088.08, 1);
  });
});

describe('runComparison', () => {
  it('runs past the end of the loan term without crashing', () => {
    const results = runComparison(property, rent, investment, 40);
    expect(results).toHaveLength(41);
    expect(results[30].mortgageLoanBalance).toBeCloseTo(0, 2);
    expect(results[35].mortgageAnnualCost).toBeLessThan(results[25].mortgageAnnualCost);
  });

  it('gives equal net worth when both strategies have identical economics', () => {
    // Free money, free housing: the renter invests every mortgage payment at 0%,
    // so both households should end with the full property price.
    const r = last(runComparison(frictionless.property, frictionless.rent, frictionless.investment, 30));
    expect(r.mortgageNetPositionAfterSale).toBeCloseTo(900000, 0);
    expect(r.rentNetPositionAfterTax).toBeCloseTo(900000, 0);
  });

  it('does not double count upfront costs', () => {
    // Stamp duty is pure loss for the buyer and nothing else changes, so the
    // renter should be ahead by exactly the stamp duty.
    const r = last(
      runComparison({ ...frictionless.property, stampDuty: 40000 }, frictionless.rent, frictionless.investment, 10)
    );
    expect(r.rentNetPositionAfterTax - r.mortgageNetPositionAfterSale).toBeCloseTo(40000, 0);
  });

  it('invests the buyer surplus when renting costs more', () => {
    const r = last(
      runComparison(frictionless.property, { ...frictionless.rent, monthlyRent: 5000 }, frictionless.investment, 30)
    );
    // Rent of $5k vs a $2k repayment: the buyer invests $3k/month.
    expect(r.mortgageInvestmentValue).toBeCloseTo(3000 * 360, 0);
  });

  it('only taxes gains, not contributions', () => {
    const r = last(
      runComparison(frictionless.property, frictionless.rent, { ...frictionless.investment, marginalTaxRate: 45 }, 20)
    );
    expect(r.rentNetPositionAfterTax).toBeCloseTo(r.rentInvestmentValue, 0);
  });

  it('treats stock return as total return, so yield only matters through tax', () => {
    const noTax = { ...investment, marginalTaxRate: 0, stockTransactionCost: 0 };
    const low = last(runComparison(property, rent, { ...noTax, dividendYield: 0 }, 30));
    const high = last(runComparison(property, rent, { ...noTax, dividendYield: 4 }, 30));
    expect(high.rentInvestmentValue / low.rentInvestmentValue).toBeCloseTo(1, 2);

    const taxed = last(runComparison(property, rent, { ...investment, dividendYield: 4 }, 30));
    const taxedLow = last(runComparison(property, rent, { ...investment, dividendYield: 0 }, 30));
    expect(taxed.rentNetPositionAfterTax).toBeLessThan(taxedLow.rentNetPositionAfterTax);
  });

  it('refunds excess franking credits for low-rate taxpayers', () => {
    const lowRate = { ...investment, marginalTaxRate: 18, dividendYield: 4 };
    const franked = last(runComparison(property, rent, { ...lowRate, frankingLevel: 100 }, 1));
    // Net dividends exceed the cash dividend because the 30% credit beats an 18% tax rate.
    const cash = franked.rentInvestmentValue * 0.04;
    expect(franked.rentDividends).toBeGreaterThan(cash * 0.95);
    expect(franked.rentFrankingCredits).toBeGreaterThan(0);
  });

  it('keeps unreinvested dividends as wealth', () => {
    const reinvest = last(runComparison(property, rent, { ...investment, dividendReinvestment: true }, 30));
    const cash = last(runComparison(property, rent, { ...investment, dividendReinvestment: false }, 30));
    expect(cash.rentNetPositionAfterTax).toBeGreaterThan(reinvest.rentNetPositionAfterTax * 0.7);
  });

  it('counts offset savings in both households', () => {
    const withOffset = runComparison({ ...property, offsetAccountBalance: 100000 }, rent, investment, 1);
    const without = runComparison(property, rent, investment, 1);
    expect(withOffset[0].mortgageNetPosition - without[0].mortgageNetPosition).toBeCloseTo(100000, 0);
    expect(withOffset[0].rentInvestmentValue - without[0].rentInvestmentValue).toBeCloseTo(100000 * 0.999, 0);
    expect(withOffset[1].mortgageTotalInterest).toBeLessThan(without[1].mortgageTotalInterest);
  });

  it('deducts the management fee from returns', () => {
    const noFee = last(runComparison(property, rent, investment, 30));
    const withFee = last(runComparison(property, rent, { ...investment, managementFee: 0.5 }, 30));
    const lowerReturn = last(runComparison(property, rent, { ...investment, stockMarketReturn: 7.5 }, 30));
    expect(withFee.rentInvestmentValue).toBeLessThan(noFee.rentInvestmentValue);
    expect(withFee.rentInvestmentValue / lowerReturn.rentInvestmentValue).toBeCloseTo(1, 2);
  });

  it('re-amortises when the interest rate path changes', () => {
    const results = runComparison(property, rent, investment, 3, { interestRate: [5.5, 8, 8] });
    expect(results[2].mortgageAnnualCost).toBeGreaterThan(results[1].mortgageAnnualCost);
  });
});

describe('helpers', () => {
  it('deflates to real terms', () => {
    const real = toRealTerms(runComparison(property, rent, investment, 10), 2.5);
    const nominal = runComparison(property, rent, investment, 10);
    expect(real[10].mortgagePropertyValue).toBeCloseTo(nominal[10].mortgagePropertyValue / 1.025 ** 10);
    expect(real[0].rentInvestmentValue).toBe(nominal[0].rentInvestmentValue);
  });

  it('finds the year buying permanently overtakes renting', () => {
    const results = runComparison(property, rent, investment, 30);
    const year = findBuyCrossoverYear(results);
    if (year !== null) {
      for (const s of results.slice(year)) {
        expect(s.mortgageNetPositionAfterSale).toBeGreaterThanOrEqual(s.rentNetPositionAfterTax);
      }
    }
  });

  it('finds break-even values that actually break even', () => {
    const { results } = calculateBreakEven(property, rent, investment, 30);
    const rentResult = results.find((r) => r.metricKey === 'monthlyRent')!;
    expect(rentResult.exists).toBe(true);
    const r = last(runComparison(property, { ...rent, monthlyRent: rentResult.breakEvenValue! }, investment, 30));
    expect(Math.abs(r.rentNetPositionAfterTax - r.mortgageNetPositionAfterSale)).toBeLessThan(5000);
  });
});

describe('monte carlo', () => {
  it('uses a positive-definite correlation matrix', () => {
    expect(() => cholesky(DEFAULT_CORRELATION_MATRIX)).not.toThrow();
  });

  it('is reproducible for a seed and centred on the deterministic result', () => {
    const a = runMonteCarloSimulation(property, rent, investment, 30, 500, 42);
    const b = runMonteCarloSimulation(property, rent, investment, 30, 500, 42);
    expect(a.percentiles).toEqual(b.percentiles);
    expect(a.percentiles.p10).toBeLessThan(a.percentiles.p90);

    const deterministic = last(runComparison(property, rent, investment, 30));
    const det = deterministic.rentNetPositionAfterTax - deterministic.mortgageNetPositionAfterSale;
    const spread = a.percentiles.p90 - a.percentiles.p10;
    expect(Math.abs(a.percentiles.p50 - det)).toBeLessThan(spread * 0.25);
  });
});

describe('share links', async () => {
  const { encodeState, decodeState } = await import('./shareState');
  const defaults = {
    property, rent, investment: { ...investment, portfolio: 'high-growth' },
    horizon: 30, sellYear: null, scenarioMode: true, realTerms: false, income: null,
  };

  it('round-trips state through the URL hash', () => {
    const state = { ...defaults, property: { ...property, propertyPrice: 1234567 }, sellYear: 12, realTerms: true };
    expect(decodeState(`#${encodeState(state)}`, defaults)).toEqual(state);
  });

  it('ignores malformed or hostile input', () => {
    expect(decodeState('#s=not-base64!!', defaults)).toBeNull();
    const evil = encodeState({ ...defaults, property: { ...property, propertyPrice: 'x' as unknown as number }, horizon: 1e9 });
    const decoded = decodeState(`#${evil}`, defaults)!;
    expect(decoded.property.propertyPrice).toBe(property.propertyPrice);
    expect(decoded.horizon).toBe(60);
  });
});

describe('gap explanation', async () => {
  const { explainGap } = await import('./gap');

  it('drivers add up exactly to the buy-minus-rent gap', () => {
    for (const years of [1, 7, 30, 40]) {
      const results = runComparison({ ...property, offsetAccountBalance: 50000, lmi: 8000 }, rent, investment, years);
      const s = last(results);
      const total = explainGap(s, { ...property, offsetAccountBalance: 50000, lmi: 8000 }).reduce((sum, d) => sum + d.amount, 0);
      expect(total).toBeCloseTo(s.mortgageNetPositionAfterSale - s.rentNetPositionAfterTax, 2);
    }
  });

  it('still adds up in today\'s dollars', () => {
    const s = last(toRealTerms(runComparison(property, rent, investment, 20), 2.5));
    const total = explainGap(s, property, 1.025 ** 20).reduce((sum, d) => sum + d.amount, 0);
    expect(total).toBeCloseTo(s.mortgageNetPositionAfterSale - s.rentNetPositionAfterTax, 2);
  });
});

describe('narrative', async () => {
  const { describeFlip, describeTiming, flipPhrase, winnerAt } = await import('./narrative');

  it('phrases break-evens in the right direction', () => {
    const base = { metric: '', exists: true, currentFavorsBuy: false, interpretation: '' };
    expect(flipPhrase({ ...base, metricKey: 'monthlyRent', currentValue: 3060, breakEvenValue: 3409.11 }))
      .toBe('rent were above $3,409 a month');
    expect(flipPhrase({ ...base, metricKey: 'interestRate', currentValue: 5.75, breakEvenValue: 4.6123 }))
      .toBe('mortgage rates averaged below 4.61%');
    expect(describeFlip([], 'rent')).toMatch(/No single assumption/);
  });

  it('describes when the winner takes the lead', () => {
    const results = runComparison(property, rent, investment, 30);
    const year = 30;
    const text = describeTiming(results, year);
    const winner = winnerAt(results[year]);
    expect(text.startsWith(winner === 'rent' ? 'Renting' : winner === 'buy' ? 'Buying' : 'The two')).toBe(true);
  });
});
