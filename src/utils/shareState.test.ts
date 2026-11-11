import { describe, expect, it } from 'vitest';
import {
  BUY_FIELDS, DEFAULT_STATE, INVEST_FIELDS, buildHash, decodeInvestState, decodeState, defaultInvestState, encodeInvestState,
  encodeState, formatParam, parseHash, parseParam,
} from './shareState';
import { CITIES, applyCity } from '../cities';
import { PORTFOLIOS, applyPortfolio } from '../portfolios';
import { withPurchaseCosts } from './homeBuyerSupport';

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('link values', () => {
  it('writes round numbers compactly and reads them back', () => {
    expect(formatParam(850000)).toBe('850k');
    expect(formatParam(1250000)).toBe('1.25m');
    expect(formatParam(6.25)).toBe('6.25');
    expect(formatParam(1234567)).toBe('1234567');
    for (const n of [0, 3, 6.25, 850000, 1250000, 1234567, -2.5, 999]) expect(parseParam(formatParam(n))).toBe(n);
  });

  it('rejects anything that is not a number', () => {
    for (const bad of ['', 'x', '1e400', '12abc', 'k', '--1', 'Infinity']) expect(parseParam(bad)).toBeNull();
  });

  it('uses each key once per page', () => {
    for (const fields of [BUY_FIELDS, INVEST_FIELDS]) {
      const keys = fields.map(([key]) => key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).not.toContain('city');
      expect(keys).not.toContain('shares');
    }
  });
});

describe('pages', () => {
  it('reads the page and view from the hash', () => {
    expect(parseHash('#property-or-shares/ledger?price=700k')).toMatchObject({ page: 'invest', mode: 'ledger' });
    expect(parseHash('#invest').page).toBe('invest');
    expect(parseHash('#learn').page).toBe('learn');
    expect(parseHash('#s=abc')).toMatchObject({ page: 'buy', legacy: 's=abc' });
    expect(parseHash('').page).toBeNull();
    expect(parseHash('#nonsense').page).toBeNull();
  });

  it('leaves the plain rent-or-buy page without a hash', () => {
    expect(buildHash('buy', 'simple', '')).toBe('');
    expect(buildHash('buy', 'ledger', '')).toBe('rent-or-buy/ledger');
    expect(buildHash('invest', 'simple', 'price=700k')).toBe('property-or-shares?price=700k');
    expect(buildHash('learn', 'ledger', '')).toBe('learn');
  });
});

describe('rent-or-buy links', () => {
  it('writes the old CGT rules only when chosen, and ignores unknown rules', () => {
    const old = { ...DEFAULT_STATE, investment: { ...DEFAULT_STATE.investment, cgtRules: 'old' as const } };
    expect(encodeState(old)).toBe('tax-rules=old');
    expect(decodeState('tax-rules=old')?.investment.cgtRules).toBe('old');
    expect(decodeState('tax-rules=nonsense')?.investment.cgtRules).toBe('reform');
  });

  it('writes nothing for the defaults', () => {
    expect(encodeState(DEFAULT_STATE)).toBe('');
  });

  it('writes a city or portfolio by name, not its values', () => {
    const sydney = CITIES.find((c) => c.id === 'sydney')!;
    const [property, rent] = applyCity(DEFAULT_STATE.property, DEFAULT_STATE.rent, sydney);
    const investment = applyPortfolio(DEFAULT_STATE.investment, PORTFOLIOS.find((p) => p.id === 'australian')!);
    const state = { ...DEFAULT_STATE, property, rent, investment };
    expect(encodeState(state)).toBe('city=sydney&shares=australian');
    expect(decodeState(encodeState(state))).toEqual({ ...state, property: { ...property, lmiEstimated: true } });
  });

  it('round-trips edited values, scenarios and switches', () => {
    const state = {
      ...DEFAULT_STATE,
      property: withPurchaseCosts({ ...DEFAULT_STATE.property, propertyPrice: 1234567, location: undefined, interestRate: { pessimistic: 8, baseline: 6, optimistic: 4 } }),
      rent: { ...DEFAULT_STATE.rent, monthlyRent: 2800 },
      investment: { ...DEFAULT_STATE.investment, couple: false, spreadSale: true },
      sellYear: 12,
      realTerms: true,
      income: 180000,
    };
    const query = encodeState(state);
    expect(query).toContain('price=1234567');
    expect(query).toContain('rate=8,6,4');
    expect(query).toContain('couple=no');
    expect(withPurchaseCosts(decodeState(query)!.property)).toEqual(state.property);
    expect({ ...decodeState(`#rent-or-buy/ledger?${query}`)!, property: state.property }).toEqual(state);
  });

  it('changes only the middle scenario figure when given one number', () => {
    const decoded = decodeState('growth=5')!;
    const base = DEFAULT_STATE.investment.propertyGrowthRate as { pessimistic: number; optimistic: number };
    expect(decoded.investment.propertyGrowthRate).toEqual({ ...base, baseline: 5 });
  });

  it('still opens old base64 links', () => {
    const old = { ...DEFAULT_STATE, horizon: 25, sellYear: 10 };
    expect(decodeState(`#s=${toBase64Url(JSON.stringify(old))}`)).toMatchObject({ horizon: 25, sellYear: 10 });
    expect(decodeState('#s=not-base64!!')).toBeNull();
  });

  it('ignores malformed or hostile input', () => {
    const decoded = decodeState('price=x&years=1e9&state=XX&city=__proto__&shares=constructor&__proto__=1&rate=1,2')!;
    expect(decoded.property.propertyPrice).toBe(DEFAULT_STATE.property.propertyPrice);
    expect(decoded.horizon).toBe(DEFAULT_STATE.horizon);
    expect(decoded.property.state).toBeUndefined();
    expect(decoded.property.interestRate).toEqual(DEFAULT_STATE.property.interestRate);
    expect(decodeState('years=999')!.horizon).toBe(60);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(decodeState('#rent-or-buy')).toBeNull();
  });
});

describe('property-or-shares links', () => {
  it('writes nothing for the defaults, and round-trips edits', () => {
    const fresh = defaultInvestState();
    expect(encodeInvestState(fresh)).toBe('');
    const state = { ...fresh, ip: { ...fresh.ip, kind: 'established' as const, price: 700000, ioYears: 0 }, sellYear: 8 };
    const query = encodeInvestState(state);
    expect(query).toBe('kind=established&price=700k&sell=8&interest-only-years=0');
    expect(decodeInvestState(new URLSearchParams(query))).toEqual(state);
  });

  it('writes a share preset by name', () => {
    const fresh = defaultInvestState();
    const aus = PORTFOLIOS.find((p) => p.id === 'australian')!;
    const state = { ...fresh, ip: { ...fresh.ip, etfReturn: aus.returns.baseline, etfFee: aus.managementFee, etfYield: aus.dividendYield, franking: aus.frankingLevel } };
    expect(encodeInvestState(state)).toBe('shares=australian');
    expect(decodeInvestState(new URLSearchParams('shares=australian'))).toEqual(state);
  });

  it('ignores malformed values', () => {
    const fresh = defaultInvestState();
    const d = decodeInvestState(new URLSearchParams('kind=castle&state=XX&rules=none&price=lots&years=500&loan=150'));
    expect(d.ip).toEqual({ ...fresh.ip, years: 40, lvr: 100 });
  });
});
