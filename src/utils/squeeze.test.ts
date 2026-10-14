import { describe, expect, it } from 'vitest';
import { runComparison } from './calculations';
import { buildSqueezePaths, type SqueezeOptions } from './squeeze';
import { simulateHousehold } from './household';
import { DEFAULT_INVESTMENT, DEFAULT_PROPERTY, DEFAULT_RENT } from '../defaults';

const P = DEFAULT_PROPERTY;
const R = DEFAULT_RENT;
const I = DEFAULT_INVESTMENT;
const central: SqueezeOptions = { severity: 1, start: 4, length: 9, rateCuts: true, profitShift: true, slump: false };
const gapAt = (results: ReturnType<typeof runComparison>, year: number) =>
  results[year].rentNetPositionAfterTax - results[year].mortgageNetPositionAfterSale;

describe('AI squeeze paths', () => {
  it('reproduces the normal calculation when there is no squeeze', () => {
    const paths = buildSqueezePaths(P, R, I, 30, { ...central, severity: 0 });
    const withPaths = runComparison(P, R, I, 30, paths);
    const plain = runComparison(P, R, I, 30);
    expect(gapAt(withPaths, 30)).toBeCloseTo(gapAt(plain, 30), 0);
  });

  it('cuts rates and slows rents during the squeeze', () => {
    const paths = buildSqueezePaths(P, R, I, 30, central);
    expect(paths.interestRate[8]).toBeLessThan(paths.interestRate[0]);
    expect(paths.rentIncreaseRate[8]).toBeLessThan(paths.rentIncreaseRate[0]);
  });

  it('a layoff slump means falling prices, not slower growth', () => {
    const paths = buildSqueezePaths(P, R, I, 30, { ...central, slump: true });
    expect(paths.propertyGrowthRate[3]).toBeLessThan(0);
    expect(paths.propertyGrowthRate[4]).toBeLessThan(0);
  });

  it('a layoff slump lowers house prices', () => {
    const severe = { ...central, severity: 2 };
    const noSlump = runComparison(P, R, I, 30, buildSqueezePaths(P, R, I, 30, severe));
    const slump = runComparison(P, R, I, 30, buildSqueezePaths(P, R, I, 30, { ...severe, slump: true }));
    expect(slump[6].mortgagePropertyValue).toBeLessThan(noSlump[6].mortgagePropertyValue);
  });
});

describe('household simulation', () => {
  const paths = buildSqueezePaths(P, R, I, 30, central);

  it('matches the engine when income is not a constraint', () => {
    const engine = runComparison(P, R, I, 30, paths);
    const rich = simulateHousehold(P, R, I, 30, paths, { grossIncome: 2_000_000, takeHome: 0.75, livingCosts: 0 }, { growth: paths.wages, spells: [] });
    for (const year of [1, 10, 30]) expect(rich.gap[year]).toBeCloseTo(gapAt(engine, year), -2);
  });

  it('income level alone does not change the gap while nobody is constrained', () => {
    const run = (grossIncome: number) =>
      simulateHousehold(P, R, I, 30, paths, { grossIncome, takeHome: 0.75, livingCosts: 4500 }, { growth: paths.wages, spells: [] });
    expect(run(400000).gap[30]).toBeCloseTo(run(250000).gap[30], -2);
  });

  it('forces a sale when a stretched buyer loses income for long enough', () => {
    const r = simulateHousehold(P, R, I, 30, paths, { grossIncome: 140000, takeHome: 0.75, livingCosts: 4500 }, {
      growth: paths.wages,
      spells: [{ startMonth: 49, months: 24, incomeShare: 0.45, reskillCost: 15000, scarring: 0.15 }],
    });
    expect(r.forcedSaleMonth).not.toBeNull();
  });
});
