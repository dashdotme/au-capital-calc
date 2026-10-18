// "AI squeeze" scenario: unemployment rises gradually as robots displace work, and year-by-year
// paths for wages, mortgage rates, house prices, rents and investment returns follow from it.
// Baselines come from the user's own inputs, so with no rise in unemployment the paths
// reproduce the normal calculation.
//
// The chain:
// - Unemployment: climbs evenly from today's rate to the peak over `riseYears`, holds for
//   `HOLD_YEARS`, then recovers over `RECOVERY_YEARS`, all the way or (if jobs don't come back)
//   only half way.
// - Slack: the gap between unemployment and the rate the economy has adjusted to. That
//   "normal" rate drifts toward actual unemployment (hysteresis), so a lasting rise stops
//   pressing on wages and rates after a while but leaves employment lower for good.
// - Wages: Phillips curve, nominal wage growth falls `PHILLIPS` points per point of slack.
//   Baseline wage growth is taken to equal baseline rent growth (rents track incomes).
// - Household income (what buyers bid with): wage growth, less the share of people losing work.
// - Rates: mortgage rate = cash rate + a fixed margin. The cash rate is cut `RATE_RESPONSE`
//   points per point of slack (if rate cuts are on), moving half way to target each year.
// - House prices: household income growth + a constant supply/population term + borrowing
//   capacity from rate changes, which reaches prices over a few years (`CAPACITY_PASS_THROUGH`)
//   as lenders stay cautious, less forced selling and caution while unemployment is rising
//   (half of which unwinds once it stops rising).
// - Rents: follow wages, less weaker household formation while unemployment rises.
// - Investments: capital deflates too. While unemployment rises, earnings fall and share
//   prices with them (`MARKET_DISTRESS`, scaled by the portfolio's share exposure); most of
//   that comes back once it stops rising. Separately, profits shift from wages to companies.
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { calculateMortgagePayment, resolveScenarioValue, type RatePaths } from './calculations';

export interface SqueezeOptions {
  /** Unemployment rate at the top (%); the starting rate means no squeeze */
  peak: number;
  /** Year unemployment starts rising */
  start: number;
  /** Years it takes to reach the peak */
  riseYears: number;
  /** Jobs come back only half way: unemployment settles between the start and the peak */
  lasting: boolean;
  rateCuts: boolean;
  profitShift: boolean;
}

export type SqueezePaths = Required<RatePaths> & {
  /** Nominal growth in household income from work (wage growth less jobs lost), % */
  wages: number[];
  /** Unemployment rate, % */
  unemployment: number[];
};

/** Unemployment today, roughly (ABS Labour Force, 2026) */
export const START_UNEMPLOYMENT = 4.5;
export const HOLD_YEARS = 3;
export const RECOVERY_YEARS = 5;
/** Assumed gap between the RBA cash rate and owner-occupier variable rates */
export const MORTGAGE_MARGIN = 2.15;
const CASH_FLOOR = 0.1;
/** Cash rate cut per point of slack */
const RATE_RESPONSE = 1.5;
/** Nominal wage growth lost per point of slack */
export const PHILLIPS = 0.6;
/** Share of the gap the economy's "normal" unemployment closes each year */
const HYSTERESIS = 0.1;
/** Price fall per point unemployment rises in a year: forced sales, caution, tighter lending */
export const DISTRESS = 5;
/** Rent growth lost per point unemployment rises in a year: people move in together */
const HOUSEHOLD_FORMATION = 1;
/** Share of the distress fall that is panic and unwinds once unemployment stops rising */
const DISTRESS_REBOUND = 0.5;
/** Share of the accumulated borrowing-capacity change that reaches prices each year */
const CAPACITY_PASS_THROUGH = 0.25;

/** Share price fall per point unemployment rises in a year (earnings recession) */
export const MARKET_DISTRESS = 8;
/** Share of the market fall that comes back once unemployment stops rising, and how fast */
const MARKET_REBOUND = 0.6;
const MARKET_REBOUND_SPEED = 0.5;

/** How much of each portfolio moves with the share market */
export const SHARE_EXPOSURE: Record<string, number> = {
  global: 1,
  us: 1,
  australian: 1,
  'high-growth': 0.9,
  balanced: 0.6,
  cash: 0,
};

/** Extra annual return per point of lost wage growth, by portfolio (profits flowing to shareholders) */
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

/** Unemployment rate in each year (index 0 = year 1). */
export function unemploymentPath(options: Pick<SqueezeOptions, 'peak' | 'start' | 'riseYears' | 'lasting'>, years: number): number[] {
  const rise = Math.max(0, options.peak - START_UNEMPLOYMENT);
  const settled = START_UNEMPLOYMENT + (options.lasting ? rise / 2 : 0);
  const riseYears = Math.max(1, options.riseYears);
  const top = options.start + riseYears - 1;
  return Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    if (year < options.start) return START_UNEMPLOYMENT;
    if (year <= top) return START_UNEMPLOYMENT + (rise * (year - options.start + 1)) / riseYears;
    if (year <= top + HOLD_YEARS) return START_UNEMPLOYMENT + rise;
    const recovered = Math.min(1, (year - top - HOLD_YEARS) / RECOVERY_YEARS);
    return START_UNEMPLOYMENT + rise + (settled - START_UNEMPLOYMENT - rise) * recovered;
  });
}

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
  const supply = baseGrowth - baseWages;
  const neutralCash = baseRate - MORTGAGE_MARGIN;
  const shift = options.profitShift ? (PROFIT_SHIFT[investment.portfolio ?? ''] ?? 0.8) : 0;
  const exposure = SHARE_EXPOSURE[investment.portfolio ?? ''] ?? 0.8;
  const rateResponse = options.rateCuts ? RATE_RESPONSE : 0;
  const unemployment = unemploymentPath(options, years);

  const paths: SqueezePaths = {
    interestRate: [], stockMarketReturn: [], propertyGrowthRate: [], rentIncreaseRate: [], wages: [], unemployment,
  };
  let previousRate = baseRate;
  let previousUnemployment = START_UNEMPLOYMENT;
  let normalUnemployment = START_UNEMPLOYMENT;
  let pendingCapacity = 0;
  let pendingRebound = 0;
  let pendingMarketRebound = 0;
  for (let year = 1; year <= years; year++) {
    const u = unemployment[year - 1];
    const rising = Math.max(0, u - previousUnemployment);
    const slack = Math.max(0, u - normalUnemployment);

    const wageGrowth = baseWages - PHILLIPS * slack;
    // Income from work grows with wages and shrinks with the share of people out of work
    const incomeGrowth = wageGrowth - (100 * (u - previousUnemployment)) / (100 - previousUnemployment);

    const targetCash = Math.max(Math.min(CASH_FLOOR, neutralCash), neutralCash - slack * rateResponse);
    const previousCash = previousRate - MORTGAGE_MARGIN;
    const rate = previousCash + (targetCash - previousCash) * 0.5 + MORTGAGE_MARGIN;

    pendingCapacity += 100 * Math.log(capacity(rate) / capacity(previousRate));
    const capacityEffect = pendingCapacity * CAPACITY_PASS_THROUGH;
    pendingCapacity -= capacityEffect;
    const distress = DISTRESS * rising;
    pendingRebound += distress * DISTRESS_REBOUND;
    // The panic part comes back gradually once unemployment has stopped rising
    const rebound = rising > 0 ? 0 : pendingRebound * CAPACITY_PASS_THROUGH;
    pendingRebound -= rebound;
    const houseGrowth = incomeGrowth + supply + capacityEffect - distress + rebound;

    paths.interestRate.push(rate);
    paths.propertyGrowthRate.push(houseGrowth);
    paths.rentIncreaseRate.push(wageGrowth - HOUSEHOLD_FORMATION * rising);
    const marketFall = MARKET_DISTRESS * exposure * rising;
    pendingMarketRebound += marketFall * MARKET_REBOUND;
    const marketRebound = rising > 0 ? 0 : pendingMarketRebound * MARKET_REBOUND_SPEED;
    pendingMarketRebound -= marketRebound;
    paths.stockMarketReturn.push(baseReturn + shift * PHILLIPS * slack - marketFall + marketRebound);
    paths.wages.push(incomeGrowth);

    previousRate = rate;
    previousUnemployment = u;
    normalUnemployment += (u - normalUnemployment) * HYSTERESIS;
  }
  return paths;
}

/**
 * Chance (0–1) that a two-earner household has someone out of work in a year, at this
 * unemployment rate: about one and a half times the rate, as most spells are new each year.
 */
export const householdJobLossChance = (unemployment: number) => Math.min(0.5, (1.5 * unemployment) / 100);

/** Longest spell out of work (months) at this unemployment rate; spells lengthen in a weak market. */
export const longestSpell = (unemployment: number) => Math.round(6 + 2 * unemployment);
