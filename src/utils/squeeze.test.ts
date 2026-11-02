import { describe, expect, it } from 'vitest';
import { runComparison } from './calculations';
import { START_UNEMPLOYMENT, buildSqueezePaths, unemploymentPath, type SqueezeOptions } from './squeeze';
import { simulateHousehold } from './household';
import { DEFAULT_INVESTMENT, DEFAULT_PROPERTY, DEFAULT_RENT } from '../defaults';

const P = DEFAULT_PROPERTY;
const R = DEFAULT_RENT;
const I = DEFAULT_INVESTMENT;
const central: SqueezeOptions = { peak: 7.5, start: 3, riseYears: 5, lasting: true, rateCuts: true, profitShift: true };
const gapAt = (results: ReturnType<typeof runComparison>, year: number) =>
  results[year].rentNetPositionAfterTax - results[year].mortgageNetPositionAfterSale;
const valueAt = (options: SqueezeOptions, year: number) =>
  runComparison(P, R, I, 30, buildSqueezePaths(P, R, I, 30, options))[year].mortgagePropertyValue;

describe('AI squeeze paths', () => {
  it('reproduces the normal calculation when unemployment stays put', () => {
    const paths = buildSqueezePaths(P, R, I, 30, { ...central, peak: START_UNEMPLOYMENT });
    const withPaths = runComparison(P, R, I, 30, paths);
    const plain = runComparison(P, R, I, 30);
    expect(gapAt(withPaths, 30)).toBeCloseTo(gapAt(plain, 30), 0);
  });

  it('raises unemployment gradually, then eases half way when jobs do not come back', () => {
    const u = unemploymentPath(central, 30);
    expect(u[1]).toBe(START_UNEMPLOYMENT);
    expect(u[3]).toBeGreaterThan(u[2]);
    expect(u[7]).toBeCloseTo(7.5);
    expect(u[29]).toBeCloseTo((START_UNEMPLOYMENT + 7.5) / 2);
    expect(unemploymentPath({ ...central, lasting: false }, 30)[29]).toBeCloseTo(START_UNEMPLOYMENT);
  });

  it('slows income growth, cuts rates and slows rents while unemployment rises', () => {
    const paths = buildSqueezePaths(P, R, I, 30, central);
    expect(paths.wages[4]).toBeLessThan(paths.wages[0]);
    expect(paths.interestRate[6]).toBeLessThan(paths.interestRate[0]);
    expect(paths.rentIncreaseRate[4]).toBeLessThan(paths.rentIncreaseRate[0]);
  });

  it('pushes prices below the no-squeeze path while unemployment is rising', () => {
    const none = { ...central, peak: START_UNEMPLOYMENT };
    expect(valueAt(central, 5)).toBeLessThan(valueAt(none, 5));
  });

  it('hurts prices more when the RBA does not cut', () => {
    expect(valueAt({ ...central, rateCuts: false }, 8)).toBeLessThan(valueAt(central, 8));
  });

  it('gives back the panic part of the fall once unemployment stops rising', () => {
    const paths = buildSqueezePaths(P, R, I, 30, { ...central, rateCuts: false });
    // Year 8 is the first year unemployment stops rising
    expect(paths.propertyGrowthRate[7]).toBeGreaterThan(paths.wages[7]);
  });
});

describe('household simulation', () => {
  const paths = buildSqueezePaths(P, R, I, 30, central);

  it('matches the engine when income is not a constraint', () => {
    // The household simulation doesn't fill the offset first (see household.ts)
    const engine = runComparison(P, R, { ...I, buyerSurplusToOffset: false }, 30, paths);
    const rich = simulateHousehold(P, R, I, 30, paths, { grossIncome: 2_000_000, takeHome: 0.75, livingCosts: 0 }, { growth: paths.wages, spells: [] });
    for (const year of [1, 10, 30]) expect(rich.gap[year]).toBeCloseTo(gapAt(engine, year), -2);
  });

  it('income level alone does not change the gap while nobody is constrained', () => {
    // Without owner moves: a move's lump-sum cost can exceed a month's surplus and force share
    // sales, which is a real constraint that depends on income
    const run = (grossIncome: number) =>
      simulateHousehold({ ...P, ownerMoveFrequency: 0 }, R, I, 30, paths, { grossIncome, takeHome: 0.75, livingCosts: 4500 }, { growth: paths.wages, spells: [] });
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

describe('price-to-income check', async () => {
  const { priceToIncome } = await import('./priceToIncome');
  const valueAt = (growth: number, year: number) =>
    runComparison(P, R, { ...I, propertyGrowthRate: growth }, 30)[year].mortgagePropertyValue;

  it('uses the city median: Brisbane is about 9.3x today', () => {
    expect(priceToIncome(P, R, valueAt(4, 30), 30).now).toBeCloseTo(9.29, 1);
  });

  it('does not warn on the default assumptions', () => {
    const check = priceToIncome(P, R, valueAt(4, 30), 30);
    expect(check.atSale).toBeGreaterThan(check.now);
    expect(check.stretched).toBe(false);
  });

  it('warns when growth runs well ahead of incomes', () => {
    const check = priceToIncome(P, R, valueAt(5.4, 30), 30);
    expect(check.atSale).toBeGreaterThan(15);
    expect(check.stretched).toBe(true);
  });

  it('keeps the multiple flat when prices grow with incomes', () => {
    const check = priceToIncome(P, R, valueAt(3.5, 30), 30);
    expect(check.atSale / check.now).toBeCloseTo(1, 1);
  });
});

describe('capital deflation in the squeeze', () => {
  const paths = (portfolio: string, profitShift = false) =>
    buildSqueezePaths(P, R, { ...I, portfolio }, 30, { ...central, profitShift });

  it('drags share returns down while unemployment rises, then partly rebounds', () => {
    const shares = paths('global');
    expect(shares.stockMarketReturn[4]).toBeLessThan(shares.stockMarketReturn[0]);
    expect(shares.stockMarketReturn[8]).toBeGreaterThan(shares.stockMarketReturn[0]);
  });

  it('leaves cash alone', () => {
    const cash = paths('cash');
    expect(cash.stockMarketReturn[4]).toBe(cash.stockMarketReturn[0]);
  });
});
