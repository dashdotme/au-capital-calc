import type { PropertyInputs, RentInputs, InvestmentInputs, MonteCarloResults } from '../types';
import { runComparison, resolveScenarioValue, type RatePaths } from './calculations';
import {
  DEFAULT_CORRELATION_MATRIX,
  DEFAULT_VARIABLE_MODELS,
  INTEREST_RATE_REVERSION,
  SIMULATED_VARIABLES,
  cholesky,
  clamp,
  correlatedNormals,
  createRng,
  percentile,
} from './distributions';

export type { MonteCarloResults } from '../types';

/** Convert a simple annual rate (%) to a continuously-compounded log rate and back. */
const toLog = (ratePct: number) => Math.log(1 + ratePct / 100);
const fromLog = (logRate: number) => (Math.exp(logRate) - 1) * 100;

/**
 * Generate one random economic path. Each variable gets a path-specific long-run average
 * plus correlated year-to-year shocks, so the simulation captures both "which world are we
 * in" uncertainty and sequence-of-returns risk.
 */
export function generateRatePaths(
  baselines: Record<(typeof SIMULATED_VARIABLES)[number], number>,
  years: number,
  rng: () => number,
  choleskyFactor: number[][] = cholesky(DEFAULT_CORRELATION_MATRIX),
  stockVolatility: number = DEFAULT_VARIABLE_MODELS.stockMarketReturn.annualStdDev
): Required<RatePaths> {
  const m = {
    ...DEFAULT_VARIABLE_MODELS,
    stockMarketReturn: { ...DEFAULT_VARIABLE_MODELS.stockMarketReturn, annualStdDev: stockVolatility },
  };
  const [zi, zr, zs, zp] = correlatedNormals(choleskyFactor, rng);
  const longRun = {
    interestRate: clamp(baselines.interestRate + zi * m.interestRate.longRunStdDev, m.interestRate.min, m.interestRate.max),
    rentIncreaseRate: baselines.rentIncreaseRate + zr * m.rentIncreaseRate.longRunStdDev,
    stockMarketReturn: baselines.stockMarketReturn + zs * m.stockMarketReturn.longRunStdDev,
    propertyGrowthRate: baselines.propertyGrowthRate + zp * m.propertyGrowthRate.longRunStdDev,
  };

  const paths: Required<RatePaths> = {
    interestRate: [],
    rentIncreaseRate: [],
    stockMarketReturn: [],
    propertyGrowthRate: [],
  };

  // Rates start at today's input and drift toward the path's long-run level.
  let rate = baselines.interestRate;
  for (let year = 0; year < years; year++) {
    const [ei, er, es, ep] = correlatedNormals(choleskyFactor, rng);
    rate += INTEREST_RATE_REVERSION * (longRun.interestRate - rate) + ei * m.interestRate.annualStdDev;
    rate = clamp(rate, m.interestRate.min, m.interestRate.max);
    paths.interestRate.push(rate);

    paths.rentIncreaseRate.push(
      clamp(longRun.rentIncreaseRate + er * m.rentIncreaseRate.annualStdDev, m.rentIncreaseRate.min, m.rentIncreaseRate.max)
    );
    paths.stockMarketReturn.push(
      clamp(fromLog(toLog(longRun.stockMarketReturn) + (es * m.stockMarketReturn.annualStdDev) / 100), m.stockMarketReturn.min, m.stockMarketReturn.max)
    );
    paths.propertyGrowthRate.push(
      clamp(fromLog(toLog(longRun.propertyGrowthRate) + (ep * m.propertyGrowthRate.annualStdDev) / 100), m.propertyGrowthRate.min, m.propertyGrowthRate.max)
    );
  }

  return paths;
}

/**
 * Run Monte Carlo simulation
 */
export function runMonteCarloSimulation(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number,
  iterations: number = 5000,
  seed: number = Date.now()
): MonteCarloResults {
  const rng = createRng(seed);
  const choleskyFactor = cholesky(DEFAULT_CORRELATION_MATRIX);
  const outcomes: number[] = [];
  const rentValues: number[][] = Array.from({ length: years + 1 }, () => []);
  const buyValues: number[][] = Array.from({ length: years + 1 }, () => []);
  const buyWins = new Array<number>(years + 1).fill(0);

  const baselines = {
    interestRate: resolveScenarioValue(propertyInputs.interestRate, 'baseline'),
    rentIncreaseRate: resolveScenarioValue(rentInputs.rentIncreaseRate, 'baseline'),
    stockMarketReturn: resolveScenarioValue(investmentInputs.stockMarketReturn, 'baseline'),
    propertyGrowthRate: resolveScenarioValue(investmentInputs.propertyGrowthRate, 'baseline'),
  };

  for (let i = 0; i < iterations; i++) {
    const paths = generateRatePaths(baselines, years, rng, choleskyFactor, investmentInputs.stockVolatility);
    const results = runComparison(propertyInputs, rentInputs, investmentInputs, years, paths);

    for (const snapshot of results) {
      rentValues[snapshot.year].push(snapshot.rentNetPositionAfterTax);
      buyValues[snapshot.year].push(snapshot.mortgageNetPositionAfterSale);
      if (snapshot.mortgageNetPositionAfterSale >= snapshot.rentNetPositionAfterTax) {
        buyWins[snapshot.year]++;
      }
    }

    // Positive = rent better
    const finalResult = results[results.length - 1];
    outcomes.push(finalResult.rentNetPositionAfterTax - finalResult.mortgageNetPositionAfterSale);
  }

  const sortedOutcomes = [...outcomes].sort((a, b) => a - b);

  const rentBetterProbability = outcomes.filter((o) => o > 0).length / iterations;
  const buyBetterProbability = 1 - rentBetterProbability;
  const expectedAdvantage = outcomes.reduce((sum, val) => sum + val, 0) / iterations;

  const percentiles = {
    p10: percentile(sortedOutcomes, 10),
    p25: percentile(sortedOutcomes, 25),
    p50: percentile(sortedOutcomes, 50),
    p75: percentile(sortedOutcomes, 75),
    p90: percentile(sortedOutcomes, 90),
  };

  // Histogram over the 1st-99th percentile so a few extreme paths don't flatten it
  const numBins = 20;
  const histMin = percentile(sortedOutcomes, 1);
  const histMax = percentile(sortedOutcomes, 99);
  const binWidth = (histMax - histMin) / numBins || 1;
  const counts = new Array<number>(numBins).fill(0);
  for (const o of outcomes) {
    counts[clamp(Math.floor((o - histMin) / binWidth), 0, numBins - 1)]++;
  }
  const histogram = counts.map((count, i) => ({
    binStart: histMin + i * binWidth,
    binEnd: histMin + (i + 1) * binWidth,
    count,
    probability: count / iterations,
  }));

  const timeSeriesPercentiles = Array.from({ length: years + 1 }, (_, year) => {
    const rentSorted = rentValues[year].sort((a, b) => a - b);
    const buySorted = buyValues[year].sort((a, b) => a - b);

    return {
      year,
      rentP10: percentile(rentSorted, 10),
      rentP50: percentile(rentSorted, 50),
      rentP90: percentile(rentSorted, 90),
      buyP10: percentile(buySorted, 10),
      buyP50: percentile(buySorted, 50),
      buyP90: percentile(buySorted, 90),
      buyBetterProbability: buyWins[year] / iterations,
    };
  });

  return {
    iterations,
    rentBetterProbability,
    buyBetterProbability,
    expectedAdvantage,
    percentiles,
    histogram,
    timeSeriesPercentiles,
    allOutcomes: sortedOutcomes,
  };
}

/** Express Monte Carlo dollar figures in today's dollars. */
export function monteCarloToRealTerms(results: MonteCarloResults, inflationRate: number, years: number): MonteCarloResults {
  const deflator = (year: number) => Math.pow(1 + inflationRate / 100, year);
  const final = deflator(years);
  const p = results.percentiles;
  return {
    ...results,
    expectedAdvantage: results.expectedAdvantage / final,
    percentiles: { p10: p.p10 / final, p25: p.p25 / final, p50: p.p50 / final, p75: p.p75 / final, p90: p.p90 / final },
    histogram: results.histogram.map((b) => ({ ...b, binStart: b.binStart / final, binEnd: b.binEnd / final })),
    timeSeriesPercentiles: results.timeSeriesPercentiles.map((t) => {
      const d = deflator(t.year);
      return {
        ...t,
        rentP10: t.rentP10 / d, rentP50: t.rentP50 / d, rentP90: t.rentP90 / d,
        buyP10: t.buyP10 / d, buyP50: t.buyP50 / d, buyP90: t.buyP90 / d,
      };
    }),
    allOutcomes: results.allOutcomes.map((o) => o / final),
  };
}
