import { describe, expect, it } from 'vitest';
import type { PropertyInputs } from '../types';
import { DEFAULT_PROPERTY } from '../defaults';
import { estimateLmi, firstHomeGrant, guaranteeApplies, withPurchaseCosts } from './homeBuyerSupport';

const home = (patch: Partial<PropertyInputs>): PropertyInputs => ({
  ...DEFAULT_PROPERTY,
  location: undefined,
  state: 'QLD',
  firstHomeBuyer: true,
  newHome: false,
  propertyPrice: 700000,
  deposit: 140000,
  lmiEstimated: true,
  ...patch,
});

describe('first home owner grant', () => {
  it('pays first home buyers of new homes under the cap', () => {
    expect(firstHomeGrant(home({ newHome: true }))).toBe(30000);
    expect(firstHomeGrant(home({ newHome: true, propertyPrice: 760000 }))).toBe(0);
    expect(firstHomeGrant(home({ newHome: true, state: 'SA', propertyPrice: 2000000 }))).toBe(15000);
  });

  it('pays nothing on established homes, to repeat buyers or in the ACT', () => {
    expect(firstHomeGrant(home({}))).toBe(0);
    expect(firstHomeGrant(home({ newHome: true, firstHomeBuyer: false }))).toBe(0);
    expect(firstHomeGrant(home({ newHome: true, state: 'ACT' }))).toBe(0);
  });
});

describe('5% Deposit Scheme and LMI', () => {
  it('waives LMI for a first home buyer with 5% down under the cap', () => {
    const p = home({ deposit: 35000 });
    expect(guaranteeApplies(p)).toBe(true);
    expect(estimateLmi(p)).toBe(0);
  });

  it('charges LMI above the cap, below 5% down, or for repeat buyers', () => {
    // 95% LVR on a $665k loan at 3.5%
    expect(estimateLmi(home({ deposit: 35000, firstHomeBuyer: false }))).toBe(23275);
    expect(guaranteeApplies(home({ propertyPrice: 1100000, deposit: 110000 }))).toBe(false);
    expect(guaranteeApplies(home({ deposit: 20000 }))).toBe(false);
  });

  it('charges nothing at 80% LVR or below', () => {
    expect(estimateLmi(home({ firstHomeBuyer: false }))).toBe(0);
  });
});

describe('withPurchaseCosts', () => {
  it('derives stamp duty, grant and LMI together', () => {
    const p = withPurchaseCosts(home({ newHome: true, deposit: 35000 }));
    expect(p.stampDuty).toBe(0);
    expect(p.firstHomeGrant).toBe(30000);
    expect(p.lmi).toBe(0);
  });

  it('keeps manual stamp duty and LMI', () => {
    const p = withPurchaseCosts(home({ state: undefined, stampDuty: 1234, lmiEstimated: false, lmi: 5000, deposit: 35000, firstHomeBuyer: false }));
    expect(p.stampDuty).toBe(1234);
    expect(p.lmi).toBe(5000);
    expect(p.firstHomeGrant).toBe(0);
  });
});
