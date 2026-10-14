import type { InvestmentInputs, ScenarioValue } from './types';

/**
 * Investment portfolio presets. Returns are long-run nominal total returns before fees,
 * blending 30-year history (Vanguard Index Chart 2026, to 30 Jun 2026) with Vanguard's
 * forward-looking capital market model (VCMM, 31 May 2026). Yields and franking from
 * Vanguard ETF factsheets (Aug 2026). Volatility is the annual standard deviation of
 * returns. Scenario triples follow the app's macro scenarios: "pessimistic" is high
 * rates and weak markets, so cash earns the most there.
 */
export interface PortfolioPreset {
  id: string;
  name: string;
  example: string;
  returns: ScenarioValue;
  dividendYield: number;
  frankingLevel: number;
  managementFee: number;
  volatility: number;
}

export const PORTFOLIOS: PortfolioPreset[] = [
  {
    id: 'high-growth',
    name: 'Diversified high growth',
    example: 'VDHG',
    returns: { pessimistic: 5.0, baseline: 7.25, optimistic: 9.0 },
    dividendYield: 2.5,
    frankingLevel: 35,
    managementFee: 0.27,
    volatility: 13,
  },
  {
    id: 'australian',
    name: 'Australian shares',
    example: 'VAS',
    returns: { pessimistic: 5.5, baseline: 7.5, optimistic: 9.0 },
    dividendYield: 3.5,
    frankingLevel: 75,
    managementFee: 0.07,
    volatility: 15,
  },
  {
    id: 'global',
    name: 'Global shares',
    example: 'VGS',
    returns: { pessimistic: 5.0, baseline: 7.5, optimistic: 9.5 },
    dividendYield: 1.5,
    frankingLevel: 0,
    managementFee: 0.18,
    volatility: 16,
  },
  {
    id: 'us',
    name: 'US shares',
    example: 'IVV',
    returns: { pessimistic: 4.0, baseline: 7.0, optimistic: 10.0 },
    dividendYield: 1.2,
    frankingLevel: 0,
    managementFee: 0.04,
    volatility: 18,
  },
  {
    id: 'balanced',
    name: 'Balanced 70/30',
    example: 'VDGR',
    returns: { pessimistic: 4.5, baseline: 6.25, optimistic: 7.75 },
    dividendYield: 2.8,
    frankingLevel: 25,
    managementFee: 0.27,
    volatility: 10,
  },
  {
    id: 'cash',
    name: 'Cash savings',
    example: 'HISA',
    // All of the return is interest, taxed each year at the marginal rate
    returns: { pessimistic: 4.75, baseline: 3.75, optimistic: 2.75 },
    dividendYield: 3.75,
    frankingLevel: 0,
    managementFee: 0,
    volatility: 2,
  },
];

export function applyPortfolio(inputs: InvestmentInputs, preset: PortfolioPreset): InvestmentInputs {
  return {
    ...inputs,
    portfolio: preset.id,
    stockMarketReturn: { ...preset.returns },
    dividendYield: preset.dividendYield,
    frankingLevel: preset.frankingLevel,
    managementFee: preset.managementFee,
    stockVolatility: preset.volatility,
  };
}
