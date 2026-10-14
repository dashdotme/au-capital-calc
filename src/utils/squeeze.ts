// "AI income squeeze" scenario: year-by-year paths for mortgage rates, house prices, rents
// and investment returns, derived from a fall in real wage growth. Baselines come from the
// user's own inputs, so with no squeeze the paths reproduce the normal calculation.
//
// The chain:
// - Wages: baseline wage growth is taken to equal baseline rent growth (rents track incomes).
//   During the squeeze real wages fall by `severity` points a year, inflation dips by half
//   that, and a quarter of the hit lingers afterwards.
// - Rates: mortgage rate = cash rate + a fixed margin. The cash rate is cut 1.5 points per
//   point of wage hit (if rate cuts are on), phased in over two years, half-normalising later.
// - House prices: wage growth + a constant supply/population term + the change in borrowing
//   capacity from the rate change. With the layoff slump on, prices instead fall outright for
//   the first two squeeze years (distressed selling), and the rate-cut boost only arrives after.
// - Rents: follow wages.
// - Investments: profits shift from wages to companies, lifting share returns by portfolio.
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { calculateMortgagePayment, resolveScenarioValue, type RatePaths } from './calculations';

export interface SqueezeOptions {
  /** Points of real wage growth lost each year during the squeeze (0.5 mild, 1 central, 2 severe) */
  severity: number;
  /** Year the squeeze starts */
  start: number;
  /** How many years it lasts */
  length: number;
  rateCuts: boolean;
  profitShift: boolean;
  slump: boolean;
}

export type SqueezePaths = Required<RatePaths> & { wages: number[] };

/** Assumed gap between the RBA cash rate and owner-occupier variable rates */
export const MORTGAGE_MARGIN = 2.15;
const CASH_FLOOR = 0.25;
const RATE_RESPONSE = 1.5;
/** Price fall per year, per point of lost wage growth, while layoffs bite */
const SLUMP_PER_POINT = 5;
const SLUMP_YEARS = 2;

/** Extra annual return per point of wage hit, by portfolio (profits flowing to shareholders) */
export const PROFIT_SHIFT: Record<string, number> = {
  global: 1.5,
  us: 2.0,
  australian: -0.5, // banks carry the mortgage stress
  'high-growth': 0.8,
  balanced: 0.5,
  cash: -0.5,
};

/** Borrowing capacity per dollar of monthly repayment on a 30-year loan. */
const capacity = (mortgageRate: number) => 1 / calculateMortgagePayment(1, mortgageRate, 30);

export function buildSqueezePaths(
  property: PropertyInputs,
  rent: RentInputs,
  investment: InvestmentInputs,
  years: number,
  options: SqueezeOptions
): SqueezePaths {
  const baseRate = resolveScenarioValue(property.interestRate, 'baseline');
  const baseWages = resolveScenarioValue(rent.rentIncreaseRate, 'baseline');
  const baseGrowth = resolveScenarioValue(investment.propertyGrowthRate, 'baseline');
  const baseReturn = resolveScenarioValue(investment.stockMarketReturn, 'baseline');
  const inflation = investment.inflationRate;
  const realWages = baseWages - inflation;
  const supply = baseGrowth - baseWages;
  const neutralCash = baseRate - MORTGAGE_MARGIN;
  const boost = options.profitShift ? (PROFIT_SHIFT[investment.portfolio ?? ''] ?? 0.8) : 0;
  const rateResponse = options.rateCuts ? RATE_RESPONSE : 0;

  const paths: SqueezePaths = { interestRate: [], stockMarketReturn: [], propertyGrowthRate: [], rentIncreaseRate: [], wages: [] };
  let previousRate = baseRate;
  let deferredBoost = 0;
  let releasesLeft = 0;
  for (let year = 1; year <= years; year++) {
    const during = year >= options.start && year < options.start + options.length;
    const after = year >= options.start + options.length;
    const hit = during ? -options.severity : 0;
    const wages = inflation + hit * 0.5 + realWages + hit + (after ? -options.severity * 0.25 : 0);

    const cashShift = during ? hit : after ? -options.severity * 0.5 : 0;
    const targetCash = Math.max(Math.min(CASH_FLOOR, neutralCash), neutralCash + cashShift * rateResponse);
    const previousCash = previousRate - MORTGAGE_MARGIN;
    const rate = previousCash + (targetCash - previousCash) * 0.5 + MORTGAGE_MARGIN;

    let capacityChange = 100 * Math.log(capacity(rate) / capacity(previousRate));
    const slumping = options.slump && options.severity > 0 && year >= options.start && year < options.start + SLUMP_YEARS;
    let houseGrowth: number;
    if (slumping) {
      // Distressed selling: prices fall outright; the rate-cut boost waits until it's over
      deferredBoost += capacityChange;
      releasesLeft = 2;
      houseGrowth = -SLUMP_PER_POINT * options.severity;
    } else {
      if (releasesLeft > 0) {
        capacityChange += deferredBoost / releasesLeft;
        deferredBoost -= deferredBoost / releasesLeft;
        releasesLeft--;
      }
      houseGrowth = wages + supply + capacityChange;
    }

    paths.interestRate.push(rate);
    paths.propertyGrowthRate.push(houseGrowth);
    paths.rentIncreaseRate.push(wages);
    paths.stockMarketReturn.push(baseReturn + boost * -hit);
    paths.wages.push(wages);
    previousRate = rate;
  }
  return paths;
}
