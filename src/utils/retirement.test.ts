// Tests for the owner-moves, strata, offset-first, super, age pension and sale-tax additions.
// Where possible the expected values come from published figures rather than the code.
import { describe, expect, it } from 'vitest';
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { runComparison } from './calculations';
import { agePension, incomeTax, rentAssistance, spreadGainTax } from './retirement';
import { ACT_DUTY_PHASE_OUT_YEARS, STAMP_DUTY_RULES, moveStampDuty } from './stampDuty';
import { DEFAULT_INVESTMENT, DEFAULT_PROPERTY, DEFAULT_RENT } from '../defaults';

const last = <T,>(xs: T[]) => xs[xs.length - 1];

/** Interest-free $720k loan ($2,000 a month) against $5,000 rent: the buyer saves $3,000 a month. */
const property: PropertyInputs = {
  propertyPrice: 900000, deposit: 180000, loanTerm: 30, interestRate: 0, stampDuty: 0, otherPurchaseCosts: 0,
  maintenanceRate: 0, councilRates: 0, buildingInsurance: 0, contentsInsurance: 0, sellingCostRate: 0,
  capitalGainsTaxRate: 0, offsetAccountBalance: 0,
};
const rent: RentInputs = { monthlyRent: 5000, rentIncreaseRate: 0, movingFrequency: 0, movingCost: 0, contentsInsurance: 0 };
const investment: InvestmentInputs = {
  stockMarketReturn: 0, propertyGrowthRate: 0, marginalTaxRate: 39, inflationRate: 0, stockTransactionCost: 0,
  dividendYield: 0, frankingLevel: 0, dividendReinvestment: true, buyerSurplusToOffset: false, age: 30,
};

describe('age pension and rent assistance (Services Australia, Sep 2026)', () => {
  it('pays the full rate with no assets', () => {
    expect(agePension({ assets: 0, homeowner: true, couple: false, index: 1 })).toBeCloseTo(1237.7 * 26, 6);
    expect(agePension({ assets: 0, homeowner: true, couple: true, index: 1 })).toBeCloseTo(1866 * 26, 6);
  });

  it('cuts out at the published part-pension asset limits', () => {
    // Published cut-offs: homeowner $745,750 single / $1,121,000 couple; non-homeowner $1,012,750 / $1,388,000
    for (const [assets, homeowner, couple] of [[745750, true, false], [1121000, true, true], [1012750, false, false], [1388000, false, true]] as const) {
      expect(agePension({ assets: assets - 5000, homeowner, couple, index: 1 })).toBeGreaterThan(0);
      expect(agePension({ assets: assets + 500, homeowner, couple, index: 1 })).toBe(0);
    }
  });

  it('means-tests rent assistance with the pension, raising the cut-off', () => {
    const ra = 223.8 * 26;
    expect(agePension({ assets: 1050000, homeowner: false, couple: false, index: 1 })).toBe(0);
    expect(agePension({ assets: 1050000, homeowner: false, couple: false, index: 1, rentAssistance: ra })).toBeGreaterThan(0);
    expect(agePension({ assets: 0, homeowner: false, couple: false, index: 1, rentAssistance: ra })).toBeCloseTo((1237.7 + 223.8) * 26, 6);
  });

  it('pays a non-homeowner more than a homeowner with the same assets (where the assets test binds)', () => {
    const at = (homeowner: boolean) => agePension({ assets: 700000, homeowner, couple: true, index: 1 });
    expect(at(false)).toBeGreaterThan(at(true));
  });

  it('reaches maximum rent assistance at the published rent ($456.20 a fortnight single)', () => {
    const monthly = (fortnightly: number) => (fortnightly * 26) / 12;
    expect(rentAssistance(monthly(157.8), false, 1)).toBeCloseTo(0, 6);
    expect(rentAssistance(monthly(456.2), false, 1)).toBeCloseTo(223.8 * 26, 6);
    expect(rentAssistance(monthly(900), false, 1)).toBeCloseTo(223.8 * 26, 6);
    // Couple: maximum $211.00 reached at $537.14
    expect(rentAssistance(monthly(537.14), true, 1)).toBeCloseTo(211 * 26, 0);
  });

  it('scales thresholds and payments with the price index', () => {
    expect(agePension({ assets: 800000, homeowner: false, couple: true, index: 2 }))
      .toBeCloseTo(2 * agePension({ assets: 400000, homeowner: false, couple: true, index: 1 }), 6);
  });

  it('pays only from 67, and leaves the homeowner ahead of a renter with the same budget', () => {
    const young = last(runComparison(DEFAULT_PROPERTY, DEFAULT_RENT, { ...DEFAULT_INVESTMENT, age: 30 }, 30));
    const older = runComparison(DEFAULT_PROPERTY, DEFAULT_RENT, { ...DEFAULT_INVESTMENT, age: 60 }, 30);
    expect(young.mortgagePension + young.rentPension).toBe(0);
    expect(older[7].mortgagePension).toBe(0);
    expect(older[8].mortgagePension).toBeGreaterThan(0);
    expect(last(older).mortgagePension).toBeGreaterThan(last(older).rentPension);
  });
});

describe('income tax and spreading a sale', () => {
  it('matches the 2027–28 brackets plus Medicare levy', () => {
    // $100k: 14% of $26,800 + 30% of $55,000 = $20,252, no LITO, + $2,000 Medicare
    expect(incomeTax(100000)).toBeCloseTo(22252, 6);
    // $18,200: no tax; LITO doesn't refund the Medicare levy
    expect(incomeTax(18200)).toBeCloseTo(364, 6);
    // $250k: $51,102 + 45% of $60,000 + $5,000 Medicare
    expect(incomeTax(250000)).toBeCloseTo(83102, 6);
  });

  it('taxes a lump sum on top of other income at the marginal brackets', () => {
    expect(spreadGainTax(50000, 1, 1, 100000)).toBeCloseTo(incomeTax(150000) - incomeTax(100000), 6);
  });

  it('taxes less when spread over more years and people', () => {
    const lump = spreadGainTax(600000, 1, 1, 0);
    expect(spreadGainTax(600000, 10, 1, 0)).toBeLessThan(lump);
    expect(spreadGainTax(600000, 10, 2, 0)).toBeLessThan(spreadGainTax(600000, 10, 1, 0));
  });

  it('only changes the after-tax figures', () => {
    const flat = last(runComparison(DEFAULT_PROPERTY, DEFAULT_RENT, DEFAULT_INVESTMENT, 30));
    const spread = last(runComparison(DEFAULT_PROPERTY, DEFAULT_RENT, { ...DEFAULT_INVESTMENT, spreadSale: true }, 30));
    expect(spread.rentNetPosition).toBeCloseTo(flat.rentNetPosition, 6);
    // Selling over 10 retirement years with no other income beats one sale at 39%
    expect(spread.rentNetPositionAfterTax).toBeGreaterThan(flat.rentNetPositionAfterTax);
  });
});

describe('salary sacrifice into super', () => {
  const sacrifice = (extra: Partial<InvestmentInputs>, years = 1) =>
    runComparison(property, rent, { ...investment, superShare: 100, superCapRoom: 1e9, ...extra }, years);

  it('grosses up each after-tax dollar and takes 15% contributions tax', () => {
    // $36,000 forgone at 39% is $59,016 pre-tax, $50,164 after contributions tax
    const s = sacrifice({})[1];
    expect(s.mortgageSuperValue).toBeCloseTo((36000 / 0.61) * 0.85, 4);
    expect(s.mortgageInvestmentValue).toBeCloseTo(0, 6);
    expect(s.mortgageContributions).toBeCloseTo(36000, 6);
  });

  it('stops at the cap room and puts the rest in shares', () => {
    const s = sacrifice({ superCapRoom: 20000 })[1];
    expect(s.mortgageSuperValue).toBeCloseTo(20000 * 0.85, 6);
    expect(s.mortgageInvestmentValue).toBeCloseTo(36000 - 20000 * 0.61, 6);
  });

  it('stops contributing at pension age', () => {
    const results = sacrifice({ age: 66 }, 3);
    expect(results[2].mortgageSuperValue).toBeCloseTo(results[1].mortgageSuperValue, 6);
  });

  it('is tax-free to withdraw from 60, and pays the fund\'s CGT before', () => {
    const grow = { stockMarketReturn: 8 };
    const before = sacrifice({ ...grow, age: 40 }, 10)[10];
    const after = sacrifice({ ...grow, age: 55 }, 10)[10];
    expect(before.mortgageNetPositionAfterSale).toBeLessThan(before.mortgageNetPosition);
    expect(after.mortgageNetPositionAfterSale).toBeCloseTo(after.mortgageNetPosition, 6);
  });
});

describe('buyer fills the offset first', () => {
  it('parks spare cash in the offset until it matches the loan', () => {
    const s = runComparison(property, rent, { ...investment, buyerSurplusToOffset: true }, 1)[1];
    expect(s.mortgageNetPosition - s.mortgageEquity - s.mortgageInvestmentValue).toBeCloseTo(36000, 6);
    expect(s.mortgageInvestmentValue).toBe(0);
  });

  it('helps the buyer when the mortgage rate beats the share return', () => {
    const p = { ...property, interestRate: 6 };
    const i = { ...investment, stockMarketReturn: 3 };
    const gap = (toOffset: boolean) => {
      const s = last(runComparison(p, rent, { ...i, buyerSurplusToOffset: toOffset }, 20));
      return s.mortgageNetPositionAfterSale - s.rentNetPositionAfterTax;
    };
    expect(gap(true)).toBeGreaterThan(gap(false));
  });
});

describe('owner moves and strata', () => {
  it('charges selling costs, duty, purchase costs and removalists at each move', () => {
    const p = { ...property, propertyPrice: 900000, sellingCostRate: 3, otherPurchaseCosts: 5000 };
    const r = { ...rent, movingCost: 2000 };
    const i = { ...investment, propertyGrowthRate: 4, inflationRate: 2 };
    const results = runComparison({ ...p, ownerMoveFrequency: 10 }, r, i, 25);
    // Moves at the start of years 11 and 21; no state picked, so duty is 4% of the value
    const moveCost = (year: number) => {
      const value = 900000 * 1.04 ** (year - 1);
      const index = 1.02 ** (year - 1);
      return value * (0.03 + 0.04) + (5000 + 2000) * index;
    };
    expect(results[10].mortgageMoveCosts).toBe(0);
    expect(results[11].mortgageMoveCosts).toBeCloseTo(moveCost(11), 4);
    expect(results[25].mortgageMoveCosts).toBeCloseTo(moveCost(11) + moveCost(21), 4);
  });

  it('shifts the gap toward renting by roughly the move costs', () => {
    const at = (ownerMoveFrequency: number) => {
      const s = last(runComparison({ ...DEFAULT_PROPERTY, ownerMoveFrequency }, DEFAULT_RENT, DEFAULT_INVESTMENT, 30));
      return s.mortgageNetPositionAfterSale - s.rentNetPositionAfterTax;
    };
    expect(at(10)).toBeLessThan(at(0));
    expect(at(5)).toBeLessThan(at(10));
  });

  it('uses full owner-occupier duty, and phases ACT duty out', () => {
    expect(moveStampDuty('NSW', 1000000, 0, 1)).toBeCloseTo(STAMP_DUTY_RULES.NSW.standard(1000000), 6);
    // Thresholds rise with prices: double the price at double the price level is double the duty
    expect(moveStampDuty('VIC', 2000000, 5, 2)).toBeCloseTo(2 * STAMP_DUTY_RULES.VIC.standard(1000000), 6);
    const act = STAMP_DUTY_RULES.ACT.standard(900000);
    expect(moveStampDuty('ACT', 900000, ACT_DUTY_PHASE_OUT_YEARS / 2, 1)).toBeCloseTo(act / 2, 6);
    expect(moveStampDuty('ACT', 900000, ACT_DUTY_PHASE_OUT_YEARS, 1)).toBe(0);
  });

  it('adds strata to running costs, rising with inflation', () => {
    const results = runComparison({ ...property, strataLevies: 6000 }, rent, { ...investment, inflationRate: 3 }, 3);
    expect(results[3].mortgageStrata).toBeCloseTo(6000 * (1 + 1.03 + 1.03 ** 2), 6);
    expect(results[3].mortgageAnnualCost - runComparison(property, rent, { ...investment, inflationRate: 3 }, 3)[3].mortgageAnnualCost)
      .toBeCloseTo(6000 * 1.03 ** 2, 6);
  });
});
