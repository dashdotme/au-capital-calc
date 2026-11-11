// Falsification tests for the engine. Each test predicts an exact or directional outcome from
// something independent of the engine's own code: closed-form maths, a published figure, an
// accounting identity, or a relation that must hold between two runs. The fuzz block repeats
// the identities over seeded random scenarios so they are tested away from hand-picked inputs.
import { describe, expect, it } from 'vitest';
import type { InvestmentInputs, PropertyInputs, RentInputs, YearlySnapshot } from '../types';
import { calculateMortgagePayment, runComparison, toRealTerms, upfrontCostsOf, type RatePaths } from './calculations';
import { createRng } from './distributions';
import { explainGap, offsetOf } from './gap';
import { AU_STATES } from './stampDuty';

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
  // Spare cash buys shares and the horizon ends before pension age, so the closed forms below
  // stay closed; the offset-first rule and the pension have their own tests
  buyerSurplusToOffset: false,
  age: 18,
  // 1 Jul 2027 counted from Nov 2026, fixed so results don't depend on today's date
  monthsToReform: 8,
};

/**
 * Interest-free $720k loan over 30 years ($2,000 a month) against $2,000 rent and nothing else,
 * so the two households spend the same every month and nobody contributes after day one.
 */
const balanced = {
  property: {
    ...property, interestRate: 0, stampDuty: 0, otherPurchaseCosts: 0, maintenanceRate: 0, councilRates: 0,
    buildingInsurance: 0, contentsInsurance: 0, sellingCostRate: 0,
  },
  rent: { ...rent, monthlyRent: 2000, rentIncreaseRate: 0, movingCost: 0, contentsInsurance: 0 },
  investment: {
    ...investment, stockMarketReturn: 7, propertyGrowthRate: 0, marginalTaxRate: 0, stockTransactionCost: 0,
    dividendYield: 0, inflationRate: 0,
  },
};

const last = <T,>(xs: T[]) => xs[xs.length - 1];
const gap = (s: YearlySnapshot) => s.mortgageNetPositionAfterSale - s.rentNetPositionAfterTax;
const gapAt = (p: PropertyInputs, r: RentInputs, i: InvestmentInputs, years = 30) => gap(last(runComparison(p, r, i, years)));
const MONETARY = [
  'mortgageEquity', 'mortgageTotalPaid', 'mortgagePropertyValue', 'mortgageLoanBalance', 'mortgageInvestmentValue',
  'mortgageNetPosition', 'mortgageNetPositionAfterSale', 'mortgageMaintenance', 'mortgageRates', 'mortgageInsurance',
  'mortgageTotalInterest', 'mortgageAnnualCost', 'mortgageContributions', 'mortgageSaleCosts', 'mortgageSpent',
  'rentTotalPaid', 'rentMovingCosts', 'rentInsurance', 'rentInvestmentValue', 'rentNetPosition', 'rentNetPositionAfterTax',
  'rentDividends', 'rentFrankingCredits', 'rentAnnualCost', 'rentContributions', 'rentSpent',
  'mortgageStrata', 'mortgageMoveCosts', 'mortgageSuperValue', 'mortgagePension', 'rentSuperValue', 'rentPension',
] as const satisfies readonly (keyof YearlySnapshot)[];

/** Relative closeness, with an absolute floor for values near zero. */
const near = (a: number, b: number, rel = 1e-9, abs = 1e-6) => Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));

describe('closed-form oracles', () => {
  it('matches a published repayment: $500k at 6% over 30 years is $2,997.75 a month', () => {
    expect(calculateMortgagePayment(500000, 6, 30)).toBeCloseTo(2997.75, 2);
  });

  it('leaves the textbook amortisation balance each year', () => {
    const loan = property.propertyPrice - property.deposit;
    const r = 0.055 / 12;
    const pmt = calculateMortgagePayment(loan, 5.5, 30);
    const results = runComparison(property, rent, investment, 30);
    for (const year of [1, 5, 10, 20, 29]) {
      const k = year * 12;
      const expected = loan * (1 + r) ** k - (pmt * ((1 + r) ** k - 1)) / r;
      expect(results[year].mortgageLoanBalance).toBeCloseTo(expected, 4);
      // Interest is whatever of the repayments didn't reduce the balance
      expect(results[year].mortgageTotalInterest).toBeCloseTo(pmt * k - (loan - expected), 4);
    }
  });

  it('charges interest only on the balance above the offset', () => {
    // B(k+1) = B(k)(1 + r) − pmt − O·r, whose solution is B* + (B0 − B*)(1 + r)^k with B* = (pmt + O·r) / r
    const loan = 720000;
    const offset = 100000;
    const r = 0.055 / 12;
    const pmt = calculateMortgagePayment(loan, 5.5, 30);
    const fixed = (pmt + offset * r) / r;
    const results = runComparison({ ...property, offsetAccountBalance: offset }, rent, investment, 10);
    for (const year of [1, 5, 10]) {
      expect(results[year].mortgageLoanBalance).toBeCloseTo(fixed + (loan - fixed) * (1 + r) ** (year * 12), 4);
    }
  });

  it('grows the buyer\'s invested savings as a monthly annuity', () => {
    // Rent $5,000 against a $2,000 repayment: the buyer invests $3,000 at the end of each month
    const results = runComparison(balanced.property, { ...balanced.rent, monthlyRent: 5000 }, balanced.investment, 10);
    const g = 1.07 ** (1 / 12);
    for (const year of [1, 10]) {
      expect(results[year].mortgageInvestmentValue).toBeCloseTo((3000 * (g ** (year * 12) - 1)) / (g - 1), 4);
    }
  });

  it('raises rent once a year, at the end of each year', () => {
    const results = runComparison(property, rent, investment, 6);
    let expected = 0;
    for (let year = 1; year <= 6; year++) {
      expected += 12 * 3000 * 1.03 ** (year - 1);
      expect(results[year].rentTotalPaid).toBeCloseTo(expected, 6);
    }
  });

  it('takes the management fee straight off the return', () => {
    const s = last(runComparison(balanced.property, balanced.rent, { ...balanced.investment, managementFee: 0.5 }, 20));
    expect(s.rentInvestmentValue).toBeCloseTo(180000 * 1.065 ** 20, 4);
  });

  it('compounds the property at exactly the growth rate', () => {
    const results = runComparison(property, rent, investment, 25);
    for (const year of [1, 10, 25]) {
      expect(results[year].mortgagePropertyValue).toBeCloseTo(900000 * 1.045 ** year, 4);
    }
  });

  it('compounds the renter\'s starting capital at exactly the stock return when budgets match', () => {
    const results = runComparison(balanced.property, balanced.rent, balanced.investment, 20);
    for (const year of [1, 10, 20]) {
      expect(results[year].rentContributions).toBe(180000);
      expect(results[year].rentInvestmentValue).toBeCloseTo(180000 * 1.07 ** year, 4);
    }
  });

  it('charges brokerage on the way in and out and discounted CGT on the gain only', () => {
    const fee = 0.004;
    const tax = 0.45;
    const s = last(runComparison(balanced.property, balanced.rent, { ...balanced.investment, stockTransactionCost: 0.4, marginalTaxRate: 45, cgtRules: 'old' }, 15));
    const value = 180000 * (1 - fee) * 1.07 ** 15;
    const proceeds = value * (1 - fee);
    expect(s.rentInvestmentValue).toBeCloseTo(value, 4);
    expect(s.rentNetPositionAfterTax).toBeCloseTo(proceeds - (proceeds - 180000) * 0.5 * tax, 4);
  });

  it('indexes the share cost base under the 2027 rules and taxes the whole real gain', () => {
    // In force from the start: no discount, cost base grown by inflation
    const run = (rate: number, monthsToReform = 0) => last(runComparison(balanced.property, balanced.rent, {
      ...balanced.investment, inflationRate: 2.5, marginalTaxRate: rate, monthsToReform,
    }, 15));
    const value = 180000 * 1.07 ** 15;
    const real = value - 180000 * 1.025 ** 15;
    expect(run(45).rentNetPositionAfterTax).toBeCloseTo(value - 0.45 * real, 4);
    // Below 30% the minimum tax applies
    expect(run(20).rentNetPositionAfterTax).toBeCloseTo(value - 0.3 * real, 4);
    // Starting after 2 years: the gain to then keeps the discount; the value then is the new cost base
    const atReform = 180000 * 1.07 ** 2;
    const tax = 0.45 * (0.5 * (atReform - 180000) + value - atReform * 1.025 ** 13);
    expect(run(45, 24).rentNetPositionAfterTax).toBeCloseTo(value - tax, 4);
  });

  it('exempts age pensioners from the 30% minimum tax', () => {
    const inv = { ...balanced.investment, inflationRate: 2.5, marginalTaxRate: 0, monthsToReform: 0, couple: false };
    // At 0% tax only the floor taxes the gain: working-age sellers pay 30%, pensioners nothing
    const young = last(runComparison(balanced.property, balanced.rent, { ...inv, age: 30 }, 10));
    expect(young.rentNetPositionAfterTax).toBeLessThan(young.rentNetPosition);
    const old = last(runComparison(balanced.property, balanced.rent, { ...inv, age: 70 }, 10));
    expect(old.rentPension).toBeGreaterThan(0);
    expect(old.rentNetPositionAfterTax).toBeCloseTo(old.rentNetPosition, 6);
  });

  it('taxes reinvested dividends with franking credits at the predicted monthly rate', () => {
    // Each month the holding grows by price growth plus the after-tax dividend, reinvested
    // with brokerage. With franking F = level × 0.3/0.7 per dollar of cash dividend, tax per
    // dollar is (1 + F) × rate − F, negative (a refund) when the credit beats the rate.
    for (const [rate, franking] of [[39, 100], [18, 100], [47, 50], [0, 100]]) {
      const y = 0.04;
      const fee = 0.001;
      const F = (franking / 100) * (0.3 / 0.7);
      const netTax = (1 + F) * (rate / 100) - F;
      const monthly = 1.07 ** (1 / 12) - y / 12 + (y / 12) * (1 - netTax) * (1 - fee);
      const s = last(runComparison(balanced.property, balanced.rent, {
        ...balanced.investment, marginalTaxRate: rate, dividendYield: 4, frankingLevel: franking, stockTransactionCost: 0.1,
      }, 10));
      expect(s.rentInvestmentValue).toBeCloseTo(180000 * (1 - fee) * monthly ** 120, 2);
    }
  });

  it('passes stamp duty through as the renter\'s extra capital, compounded and taxed on the gain', () => {
    const base = { ...balanced.investment, marginalTaxRate: 30, cgtRules: 'old' as const };
    const without = last(runComparison(balanced.property, balanced.rent, base, 12));
    const withDuty = last(runComparison({ ...balanced.property, stampDuty: 50000 }, balanced.rent, base, 12));
    const grown = 50000 * 1.07 ** 12;
    expect(withDuty.mortgageNetPositionAfterSale).toBeCloseTo(without.mortgageNetPositionAfterSale, 6);
    expect(withDuty.rentNetPositionAfterTax - without.rentNetPositionAfterTax).toBeCloseTo(grown - (grown - 50000) * 0.5 * 0.3, 4);
  });

  it('applies the CGT discount and the full cost base (price, purchase and selling costs) to the home', () => {
    const p = { ...property, capitalGainsTaxRate: 37 };
    const s = runComparison(p, rent, investment, 15)[15];
    const selling = s.mortgagePropertyValue * 0.03;
    const gain = s.mortgagePropertyValue - (900000 + upfrontCostsOf(p) + selling);
    expect(s.mortgageSaleCosts).toBeCloseTo(selling + gain * 0.5 * 0.37, 4);
  });

  it('indexes rates, insurance and moving costs to inflation from year 2', () => {
    const results = runComparison(property, rent, investment, 4);
    expect(results[1].mortgageRates).toBeCloseTo(2500, 6);
    expect(results[4].mortgageRates).toBeCloseTo(2500 * (1 + 1.025 + 1.025 ** 2 + 1.025 ** 3), 6);
    // Moves every 3 years: one move by year 4, priced at year-3 levels
    expect(results[4].rentMovingCosts).toBeCloseTo(2000 * 1.025 ** 2, 6);
  });
});

describe('accounting identities', () => {
  it('spends the same total in both households every year (equal budget)', () => {
    for (const [monthlyRent, investedShare] of [[3000, 100], [6000, 100], [3000, 40], [6000, 40]]) {
      const results = runComparison(property, { ...rent, monthlyRent }, { ...investment, investedShare }, 40);
      const start = results[0].rentContributions;
      let buyerOut = 0;
      let renterOut = 0;
      for (const s of results.slice(1)) {
        buyerOut += s.mortgageAnnualCost;
        renterOut += s.rentAnnualCost;
        expect(buyerOut + s.mortgageContributions + s.mortgageSpent)
          .toBeCloseTo(renterOut + s.rentContributions - start + s.rentSpent, 4);
      }
    }
  });

  it('splits every repayment into interest and principal with nothing lost', () => {
    const p = { ...property, lmi: 12000, offsetAccountBalance: 40000 };
    for (const s of runComparison(p, rent, investment, 35)) {
      const loan = p.propertyPrice - p.deposit + 12000;
      expect(s.mortgageTotalPaid - upfrontCostsOf(p) - s.mortgageTotalInterest).toBeCloseTo(loan - s.mortgageLoanBalance, 4);
    }
  });

  it('starts both households with identical net worth', () => {
    const p = { ...property, offsetAccountBalance: 60000, firstHomeGrant: 10000 };
    const s = runComparison(p, rent, { ...investment, stockTransactionCost: 0 }, 1)[0];
    // Before any growth, buying has only converted cash into purchase costs
    expect(s.rentNetPosition - s.mortgageNetPosition).toBeCloseTo(upfrontCostsOf(p), 6);
  });
});

describe('metamorphic relations', () => {
  const scale = (k: number): [PropertyInputs, RentInputs, InvestmentInputs] => [
    {
      ...property, propertyPrice: property.propertyPrice * k, deposit: property.deposit * k, stampDuty: property.stampDuty * k,
      otherPurchaseCosts: property.otherPurchaseCosts * k, councilRates: property.councilRates * k,
      buildingInsurance: property.buildingInsurance * k, contentsInsurance: property.contentsInsurance * k,
      offsetAccountBalance: 50000 * k, lmi: 5000 * k, firstHomeGrant: 10000 * k,
    },
    { ...rent, monthlyRent: rent.monthlyRent * k, movingCost: rent.movingCost * k, contentsInsurance: rent.contentsInsurance * k },
    investment,
  ];

  it('scales every dollar output by k when every dollar input is scaled by k', () => {
    const one = runComparison(...scale(1), 35);
    const three = runComparison(...scale(3), 35);
    for (let y = 0; y <= 35; y++) {
      for (const key of MONETARY) expect(near(three[y][key], one[y][key] * 3, 1e-9, 1e-4), `${key} year ${y}`).toBe(true);
    }
  });

  it('gives the same early years whatever the horizon (no look-ahead)', () => {
    expect(runComparison(property, rent, investment, 10)).toEqual(runComparison(property, rent, investment, 30).slice(0, 11));
  });

  it('treats a constant rate path the same as no path', () => {
    const paths: RatePaths = {
      interestRate: Array(30).fill(5.5), stockMarketReturn: Array(30).fill(8),
      propertyGrowthRate: Array(30).fill(4.5), rentIncreaseRate: Array(30).fill(3),
    };
    expect(runComparison(property, rent, investment, 30, paths)).toEqual(runComparison(property, rent, investment, 30));
  });

  it('treats a scenario range with equal ends the same as a single number', () => {
    const flat = (v: number) => ({ pessimistic: v, baseline: v, optimistic: v });
    expect(runComparison({ ...property, interestRate: flat(5.5) }, { ...rent, rentIncreaseRate: flat(3) },
      { ...investment, stockMarketReturn: flat(8), propertyGrowthRate: flat(4.5) }, 30))
      .toEqual(runComparison(property, rent, investment, 30));
  });

  it('leaves figures unchanged when deflating at 0% inflation', () => {
    const results = runComparison(property, rent, investment, 10);
    expect(toRealTerms(results, 0)).toEqual(results);
  });

  const increasing = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]);
  const decreasing = (xs: number[]) => increasing([...xs].reverse());

  it('favours buying more as rent or home price growth rises', () => {
    expect(increasing([2000, 3000, 4000, 5000].map((monthlyRent) => gapAt(property, { ...rent, monthlyRent }, investment)))).toBe(true);
    expect(increasing([1, 3, 5, 7].map((propertyGrowthRate) => gapAt(property, rent, { ...investment, propertyGrowthRate })))).toBe(true);
    expect(increasing([0, 2, 4, 6].map((rentIncreaseRate) => gapAt(property, { ...rent, rentIncreaseRate }, investment)))).toBe(true);
  });

  it('favours renting more as rates, costs or share returns rise', () => {
    expect(decreasing([3, 5, 7, 9].map((interestRate) => gapAt({ ...property, interestRate }, rent, investment)))).toBe(true);
    expect(decreasing([0, 1, 2, 3].map((maintenanceRate) => gapAt({ ...property, maintenanceRate }, rent, investment)))).toBe(true);
    expect(decreasing([0, 2, 4, 6].map((sellingCostRate) => gapAt({ ...property, sellingCostRate }, rent, investment)))).toBe(true);
    expect(decreasing([0, 30000, 60000].map((stampDuty) => gapAt({ ...property, stampDuty }, rent, investment)))).toBe(true);
    expect(decreasing([4, 6, 8, 10].map((stockMarketReturn) => gapAt(property, rent, { ...investment, stockMarketReturn })))).toBe(true);
  });

  it('never lets a higher tax rate raise the renter\'s after-tax wealth (without franking)', () => {
    const after = [0, 19, 32.5, 39, 47].map((marginalTaxRate) =>
      last(runComparison(property, rent, { ...investment, marginalTaxRate }, 30)).rentNetPositionAfterTax);
    expect(decreasing(after)).toBe(true);
  });
});

describe('seeded fuzz: identities hold for random scenarios', () => {
  const rng = createRng(20261101);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const scenarios = Array.from({ length: 200 }, () => {
    const price = between(300000, 3000000);
    const loanTerm = Math.round(between(10, 30));
    const years = Math.round(between(1, 45));
    const p: PropertyInputs = {
      propertyPrice: price, deposit: price * between(0.05, 0.6), loanTerm, interestRate: between(0.5, 10),
      stampDuty: between(0, 150000), otherPurchaseCosts: between(0, 20000), maintenanceRate: between(0, 2.5),
      councilRates: between(0, 6000), buildingInsurance: between(0, 3000), contentsInsurance: between(0, 2000),
      sellingCostRate: between(0, 4), capitalGainsTaxRate: rng() < 0.3 ? between(0, 47) : 0,
      offsetAccountBalance: rng() < 0.5 ? between(0, 300000) : 0, lmi: rng() < 0.3 ? between(0, 40000) : 0,
      firstHomeGrant: rng() < 0.2 ? between(0, 30000) : 0, newHome: rng() < 0.3,
      strataLevies: rng() < 0.3 ? between(0, 9000) : 0,
      ownerMoveFrequency: rng() < 0.4 ? Math.round(between(1, 15)) : 0,
      state: rng() < 0.5 ? AU_STATES[Math.floor(rng() * AU_STATES.length)] : undefined,
    };
    const r: RentInputs = {
      monthlyRent: between(800, 9000), rentIncreaseRate: between(0, 7), movingFrequency: Math.round(between(0, 6)),
      movingCost: between(0, 6000), contentsInsurance: between(0, 1500),
    };
    const i: InvestmentInputs = {
      stockMarketReturn: between(-2, 12), propertyGrowthRate: between(-2, 9), marginalTaxRate: between(0, 47),
      inflationRate: between(0, 5), stockTransactionCost: between(0, 1), dividendYield: between(0, 6),
      frankingLevel: between(0, 100), dividendReinvestment: rng() < 0.7, managementFee: between(0, 1),
      investedShare: rng() < 0.5 ? 100 : between(0, 100),
      buyerSurplusToOffset: rng() < 0.5, age: Math.round(between(18, 80)), couple: rng() < 0.5,
      superShare: rng() < 0.5 ? between(0, 100) : 0, superCapRoom: between(0, 80000),
      spreadSale: rng() < 0.5, saleYears: Math.round(between(1, 20)), saleIncome: between(0, 200000),
    };
    const paths: RatePaths = rng() < 0.5
      ? {
          interestRate: Array.from({ length: years }, () => between(0.5, 12)),
          stockMarketReturn: Array.from({ length: years }, () => between(-30, 35)),
          propertyGrowthRate: Array.from({ length: years }, () => between(-15, 20)),
          rentIncreaseRate: Array.from({ length: years }, () => between(-3, 10)),
        }
      : {};
    return { p, r, i, years, paths };
  });

  it('never produces NaN or infinite figures', () => {
    for (const { p, r, i, years, paths } of scenarios) {
      for (const s of runComparison(p, r, i, years, paths)) {
        for (const key of MONETARY) expect(Number.isFinite(s[key]), key).toBe(true);
      }
    }
  });

  it('keeps the equal-budget identity', () => {
    for (const { p, r, i, years, paths } of scenarios) {
      // Starting offset cash moving into shares is not budget, so test without it. Savings the
      // buyer parks in the offset are. Pensions are income on top of the budget.
      const results = runComparison({ ...p, offsetAccountBalance: 0 }, r, i, years, paths);
      const s = last(results);
      const buyerOut = results.slice(1).reduce((sum, x) => sum + x.mortgageAnnualCost, 0);
      const renterOut = results.slice(1).reduce((sum, x) => sum + x.rentAnnualCost, 0);
      expect(near(buyerOut + s.mortgageContributions + offsetOf(s) + s.mortgageSpent - s.mortgagePension,
        renterOut + s.rentContributions - results[0].rentContributions + s.rentSpent - s.rentPension, 1e-9, 1e-3)).toBe(true);
    }
  });

  it('pays the loan off exactly at the end of its term, whatever the rate path', () => {
    for (const { p, r, i: i0, paths } of scenarios) {
      // Filling the offset pays the loan off early, so test the scheduled repayments alone
      const i = { ...i0, buyerSurplusToOffset: false };
      const results = runComparison(p, r, i, p.loanTerm, paths);
      expect(last(results).mortgageLoanBalance).toBeLessThan(0.01);
      if ((p.offsetAccountBalance ?? 0) === 0 && p.loanTerm > 1) {
        expect(results[p.loanTerm - 1].mortgageLoanBalance).toBeGreaterThan(1);
      }
    }
  });

  it('accounts for every repayment as interest or principal', () => {
    for (const { p, r, i, years, paths } of scenarios) {
      const loan = Math.max(0, p.propertyPrice - p.deposit + (p.lmi ?? 0));
      for (const s of runComparison(p, r, i, years, paths)) {
        expect(near(s.mortgageTotalPaid - upfrontCostsOf(p) - s.mortgageTotalInterest, loan - s.mortgageLoanBalance, 1e-9, 1e-3)).toBe(true);
      }
    }
  });

  it('explains the whole buy-minus-rent gap', () => {
    for (const { p, r, i, years, paths } of scenarios) {
      const s = last(runComparison(p, r, i, years, paths));
      const total = explainGap(s, p).reduce((sum, d) => sum + d.amount, 0);
      expect(near(total, gap(s), 1e-9, 1e-3)).toBe(true);
    }
  });

  it('scales with money', () => {
    for (const { p: p0, r, i: i0, years, paths } of scenarios.slice(0, 50)) {
      const k = 2.5;
      // Scale-free settings: no pension (means-test thresholds are fixed dollars), no bracket
      // tax on sales, no state duty schedule, and the super cap scaled along with everything
      const p = { ...p0, state: undefined };
      const i = { ...i0, age: 18, spreadSale: false };
      const scaled = runComparison(
        { ...p, strataLevies: (p.strataLevies ?? 0) * k, propertyPrice: p.propertyPrice * k, deposit: p.deposit * k, stampDuty: p.stampDuty * k,
          otherPurchaseCosts: p.otherPurchaseCosts * k, councilRates: p.councilRates * k, buildingInsurance: p.buildingInsurance * k,
          contentsInsurance: p.contentsInsurance * k, offsetAccountBalance: (p.offsetAccountBalance ?? 0) * k,
          lmi: (p.lmi ?? 0) * k, firstHomeGrant: (p.firstHomeGrant ?? 0) * k },
        { ...r, monthlyRent: r.monthlyRent * k, movingCost: r.movingCost * k, contentsInsurance: r.contentsInsurance * k },
        { ...i, superCapRoom: (i.superCapRoom ?? 0) * k }, years, paths);
      const base = runComparison(p, r, i, years, paths);
      const s = last(scaled);
      const b = last(base);
      for (const key of MONETARY) expect(near(s[key], b[key] * k, 1e-7, 1e-2), key).toBe(true);
    }
  });
});
