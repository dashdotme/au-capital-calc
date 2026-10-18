import { describe, expect, it } from 'vitest';
import { calculateStampDuty } from './stampDuty';

describe('standard owner-occupier stamp duty', () => {
  // The figures the city presets used to hard-code, worked from each state's schedule
  it.each([
    ['NSW', 1198596, 48124],
    ['VIC', 780550, 41903],
    ['QLD', 1048880, 33661],
    ['WA', 975022, 41329],
    ['SA', 928560, 44901],
    ['ACT', 861744, 25801],
    ['TAS', 741496, 28552],
    ['NT', 633431, 31355],
  ] as const)('%s at $%i', (state, price, expected) => {
    expect(Math.abs(calculateStampDuty(state, price, false) - expected)).toBeLessThanOrEqual(1);
  });

  it('applies the VIC principal residence concession up to $550k', () => {
    expect(calculateStampDuty('VIC', 500000, false)).toBe(18370 + 3600);
  });

  it('uses the NT formula below $525k', () => {
    // (0.06571441 × 400²) + 15 × 400
    expect(calculateStampDuty('NT', 400000, false)).toBe(16514);
  });
});

describe('first home buyer stamp duty', () => {
  it('is nothing under each exemption threshold', () => {
    expect(calculateStampDuty('NSW', 800000, true)).toBe(0);
    expect(calculateStampDuty('VIC', 600000, true)).toBe(0);
    expect(calculateStampDuty('QLD', 700000, true)).toBe(0);
    expect(calculateStampDuty('WA', 500000, true)).toBe(0);
    expect(calculateStampDuty('ACT', 1500000, true)).toBe(0);
  });

  it('tapers through the concession bands', () => {
    // Revenue NSW example: $950k pays about $29,390 against $36,937 standard
    expect(calculateStampDuty('NSW', 950000, false)).toBe(36937);
    expect(calculateStampDuty('NSW', 950000, true)).toBe(29390);
    // VIC $625k: $32,570 standard, $5,428 concessional
    expect(calculateStampDuty('VIC', 625000, true)).toBe(5428);
    // QLD $750k: home concession $19,600 less the $8,675 first home concession
    expect(calculateStampDuty('QLD', 750000, true)).toBe(10925);
    expect(calculateStampDuty('WA', 600000, true)).toBe(13630);
  });

  it('pays full duty above the caps and where there is no established-home relief', () => {
    expect(calculateStampDuty('NSW', 1000000, true)).toBe(calculateStampDuty('NSW', 1000000, false));
    expect(calculateStampDuty('VIC', 760000, true)).toBe(calculateStampDuty('VIC', 760000, false));
    expect(calculateStampDuty('QLD', 800000, true)).toBe(calculateStampDuty('QLD', 800000, false));
    expect(calculateStampDuty('WA', 710000, true)).toBe(calculateStampDuty('WA', 710000, false));
    for (const state of ['SA', 'TAS', 'NT'] as const) {
      expect(calculateStampDuty(state, 600000, true)).toBe(calculateStampDuty(state, 600000, false));
    }
  });

  it('never charges a first home buyer more than standard duty', () => {
    for (const state of ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const) {
      for (let price = 100000; price <= 2000000; price += 5000) {
        expect(calculateStampDuty(state, price, true)).toBeLessThanOrEqual(calculateStampDuty(state, price, false));
      }
    }
  });
});

describe('new homes', () => {
  it('exempts first home buyers in QLD and SA at any price', () => {
    expect(calculateStampDuty('QLD', 1500000, true, true)).toBe(0);
    expect(calculateStampDuty('SA', 1500000, true, true)).toBe(0);
  });

  it('matches established-home rules elsewhere and for repeat buyers', () => {
    expect(calculateStampDuty('NSW', 950000, true, true)).toBe(29390);
    expect(calculateStampDuty('QLD', 750000, false, true)).toBe(calculateStampDuty('QLD', 750000, false));
  });
});
