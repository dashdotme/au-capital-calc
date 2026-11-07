import { describe, expect, it } from 'vitest';
import { breakEvenGrowth, capitalGainTax, monthsUntilReform, runInvestmentProperty, stampDutyFor, type IpInputs } from './investmentProperty';
import { investorStampDuty } from './stampDuty';
import { DEFAULT_IP } from '../defaults';

const base: IpInputs = { ...DEFAULT_IP, monthsToReform: 8 };
const last = (input: IpInputs) => runInvestmentProperty(input).years.at(-1)!;

describe('capital gains under the 2027 reform', () => {
  it("matches the Budget explainer's cameo: $500k at 1 Jul 2027, sold for $560k two years later", () => {
    // Indexed cost base 500,000 × 1.025² = 525,312.50, so the real gain is $34,687.50; at 47% that's $16,303
    const real = 560000 - 500000 * 1.025 ** 2;
    expect(real).toBeCloseTo(34687.5, 1);
    expect(capitalGainTax(300000, 0, real, 1)).toBeCloseTo(16303, 0);
  });

  it('charges at least 30% on a real gain, even with no other income', () => {
    expect(capitalGainTax(0, 0, 10000, 1)).toBeCloseTo(3000, 6);
  });

  it('leaves the discounted part at marginal rates', () => {
    // $10k discounted gain on top of $0 income stays under the tax-free threshold (Medicare only)
    expect(capitalGainTax(0, 10000, 0, 1)).toBeCloseTo(200, 6);
  });

  it('counts months to 1 July 2027', () => {
    expect(monthsUntilReform(new Date(2026, 10, 7))).toBe(8);
    expect(monthsUntilReform(new Date(2027, 6, 1))).toBeLessThanOrEqual(0);
  });

  it('uses the 50% discount for a sale before the reform starts', () => {
    const y = runInvestmentProperty({ ...base, years: 1, monthsToReform: 24 }).years[0];
    expect(y.cgtMethod).toBe('discount');
  });
});

describe('investor stamp duty', () => {
  it("matches QRO's worked example: $850k investment property, $31,275", () => {
    expect(investorStampDuty('QLD', 850000)).toBe(31275);
  });

  it('uses the ACT non-owner-occupier table', () => {
    expect(investorStampDuty('ACT', 600000)).toBe(Math.round(11400 + 0.0432 * 100000));
  });

  it('uses VIC general rates with no residence concession', () => {
    expect(investorStampDuty('VIC', 500000)).toBe(Math.round(2870 + 0.06 * 370000));
  });

  it('charges a house-and-land build on the land only', () => {
    const land = stampDutyFor({ kind: 'new', state: 'QLD', price: 1000000, landShare: 55 });
    expect(land).toBe(investorStampDuty('QLD', 550000));
    expect(stampDutyFor({ kind: 'established', state: 'QLD', price: 1000000, landShare: 55 })).toBeGreaterThan(land);
  });
});

describe('negative gearing', () => {
  // A geared, low-yield property that loses money for years
  const geared: IpInputs = { ...base, lvr: 80, grossYield: 3.5, interestRate: 6.5 };

  it('quarantines losses on an established home from July 2027 and carries them forward', () => {
    const run = runInvestmentProperty({ ...geared, kind: 'established' });
    expect(run.years[2].carriedLoss).toBeGreaterThan(0);
    // Before the reform the loss still reduced salary tax
    expect(runInvestmentProperty({ ...geared, kind: 'established', rules: 'old' }).years.every((y) => y.carriedLoss === 0)).toBe(true);
  });

  it('never quarantines a new build', () => {
    expect(runInvestmentProperty({ ...geared, kind: 'new' }).years.every((y) => y.carriedLoss === 0)).toBe(true);
  });

  it('leaves an established home worse off under the reform than under the old rules, all else equal', () => {
    const established = { ...geared, kind: 'established' as const };
    // Shares lose the discount too, so compare the property's yearly tax: no refund on the loss
    const reform = runInvestmentProperty(established).years;
    const old = runInvestmentProperty({ ...established, rules: 'old' }).years;
    expect(reform[3].taxDifference).toBeGreaterThan(old[3].taxDifference);
  });
});

describe('metamorphic relations', () => {
  it('faster property growth helps only the property investor', () => {
    // The NT has no land tax, which would otherwise rise with prices
    const established = { ...base, kind: 'established' as const, state: 'NT' as const };
    const slow = last({ ...established, growth: 3 });
    const fast = last({ ...established, growth: 5 });
    expect(fast.propertyNet).toBeGreaterThan(slow.propertyNet);
    // The shares investor's only link to the property is matching its cash shortfalls, and
    // rent follows rent growth, not prices, once let
    expect(fast.sharesNet).toBeCloseTo(slow.sharesNet, 6);
  });

  it('charges land tax once the land outgrows the threshold, and the shares investor matches it', () => {
    // QLD: a $425k lot pays nothing until it passes $600k; faster growth gets there sooner
    const slow = runInvestmentProperty({ ...base, growth: 2 }).years;
    const fast = runInvestmentProperty({ ...base, growth: 6 }).years;
    expect(fast.at(-1)!.sharesNet).toBeGreaterThan(slow.at(-1)!.sharesNet);
    expect(fast.at(-1)!.cashFlow).toBeLessThan(runInvestmentProperty({ ...base, growth: 6, state: 'NT' }).years.at(-1)!.cashFlow);
  });

  it('higher share returns help both, but the shares-only investor more', () => {
    const low = last({ ...base, etfReturn: 6 });
    const high = last({ ...base, etfReturn: 9 });
    expect(high.sharesNet - low.sharesNet).toBeGreaterThan(high.propertyNet - low.propertyNet);
  });

  it('with no leverage, no costs, no tax effects and identical returns, both finish nearly level', () => {
    const neutral: IpInputs = {
      ...base, kind: 'established', lvr: 0, landShare: 100, maintenance: 0, insurance: 0, councilRates: 0, strata: 0,
      management: 0, vacancy: 0, purchaseCosts: 0, sellingCosts: 0, capitalWorksBase: 0, plant: 0, state: 'NT',
      growth: 3, grossYield: 4, rentGrowth: 3, etfReturn: 7.12, etfFee: 0, etfYield: 4, franking: 0, rules: 'old',
    };
    const y = last(neutral);
    // Stamp duty is the only friction left; the property side carries it as part of its cost
    expect(Math.abs(y.propertyNet - y.sharesNet) / y.sharesNet).toBeLessThan(0.05);
  });

  it('finds a break-even growth rate where the two finish level', () => {
    const g = breakEvenGrowth(base);
    expect(g).not.toBeNull();
    const y = last({ ...base, growth: g! });
    expect(Math.abs(y.propertyNet - y.sharesNet)).toBeLessThan(100);
  });
});

describe('land tax', async () => {
  const { landTaxToday, landTax } = await import('./landTax');

  it("matches the state revenue offices' schedules", () => {
    expect(landTaxToday('QLD', 600000)).toBe(0);
    expect(landTaxToday('QLD', 700000)).toBeCloseTo(1500, 6);
    expect(landTaxToday('NSW', 1200000)).toBeCloseTo(2100, 6);
    // RevenueSA's worked example: $1,470,000 of land pays $2,670
    expect(landTaxToday('SA', 1470000)).toBeCloseTo(2670, 6);
    // VIC bands run "from $X to under $Y"
    expect(landTaxToday('VIC', 100000)).toBe(975);
    expect(landTaxToday('VIC', 500000)).toBeCloseTo(1950, 6);
    // ACT: the fixed charge from the first dollar
    expect(landTaxToday('ACT', 100000)).toBeCloseTo(1778 + 540, 6);
    expect(landTaxToday('NT', 5e6)).toBe(0);
  });

  it('keeps SA in step with land values and ACT with inflation; others stay put', () => {
    expect(landTax('SA', 1470000 * 1.5, 1.5, 1.1)).toBeCloseTo(2670 * 1.5, 6);
    expect(landTax('ACT', 100000 * 1.1, 1.3, 1.1)).toBeCloseTo((1778 + 540) * 1.1, 6);
    expect(landTax('QLD', 700000, 1.5, 1.2)).toBeCloseTo(1500, 6);
  });
});

describe('loan behaviour', () => {
  it('pays interest only for the IO period, then principal and interest over the rest of the term', () => {
    const years = runInvestmentProperty({ ...base, kind: 'established', ioYears: 5 }).years;
    expect(years[4].loanBalance).toBeCloseTo(years[0].loanBalance, 6);
    expect(years[5].loanBalance).toBeLessThan(years[4].loanBalance);
    // 25 years of P&I from year 5 clears the loan by year 30
    expect(runInvestmentProperty({ ...base, kind: 'established', ioYears: 5, years: 30 }).years.at(-1)!.loanBalance).toBeLessThan(1);
  });

  it('adds lenders mortgage insurance to the loan above 80%', () => {
    expect(runInvestmentProperty({ ...base, lvr: 80 }).lmi).toBe(0);
    const high = runInvestmentProperty({ ...base, lvr: 90 });
    expect(high.lmi).toBeGreaterThan(0);
    expect(high.loan).toBeCloseTo(base.price * 0.9 + high.lmi, 6);
    // The premium is borrowed, not paid from the deposit
    expect(high.startingCash).toBeCloseTo(base.price * 0.1 + high.stampDuty + base.purchaseCosts, 6);
  });

  it('grows a new build a point slower for its first 10 years', () => {
    const value = (kind: 'new' | 'established', year: number) =>
      runInvestmentProperty({ ...base, kind, years: 20 }).years[year - 1].propertyValue;
    expect(value('new', 10) / value('established', 10)).toBeCloseTo(Math.pow(1.03 / 1.04, 10), 3);
    expect(value('new', 20) / value('new', 10)).toBeCloseTo(value('established', 20) / value('established', 10), 6);
  });
});

describe('horizon', () => {
  it("doesn't change a year's result", () => {
    const short = runInvestmentProperty({ ...base, years: 8 }).years.at(-1)!;
    const long = runInvestmentProperty({ ...base, years: 25 }).years[7];
    expect(long).toEqual(short);
  });
});
