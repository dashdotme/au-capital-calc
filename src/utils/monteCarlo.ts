import type { PropertyInputs, RentInputs, InvestmentInputs } from '../types';
import { runComparison, isScenarioValue } from './calculations';
import { generateCorrelatedSamples, percentile } from './distributions';

export interface MonteCarloResults {
  iterations: number;
  rentBetterProbability: number;
  buyBetterProbability: number;
  expectedAdvantage: number; // Positive = rent better, negative = buy better
  percentiles: {
    p10: number;
    p25: number;
    p50: number; // Median
    p75: number;
    p90: number;
  };
  histogram: {
    binStart: number;
    binEnd: number;
    count: number;
    probability: number;
  }[];
  timeSeriesPercentiles: {
    year: number;
    rentP10: number;
    rentP50: number;
    rentP90: number;
    buyP10: number;
    buyP50: number;
    buyP90: number;
  }[];
  allOutcomes: number[]; // Raw differences for advanced analysis
}

/**
 * Run Monte Carlo simulation
 */
export function runMonteCarloSimulation(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number,
  iterations: number = 5000
): MonteCarloResults {
  const outcomes: number[] = [];
  const timeSeriesData: {
    rentValues: number[][];
    buyValues: number[][];
  } = {
    rentValues: Array.from({ length: years + 1 }, () => []),
    buyValues: Array.from({ length: years + 1 }, () => []),
  };

  // Get baseline values
  const baselineInterestRate = isScenarioValue(propertyInputs.interestRate)
    ? propertyInputs.interestRate.baseline
    : propertyInputs.interestRate;
  const baselineRentIncrease = isScenarioValue(rentInputs.rentIncreaseRate)
    ? rentInputs.rentIncreaseRate.baseline
    : rentInputs.rentIncreaseRate;
  const baselineStockReturn = isScenarioValue(investmentInputs.stockMarketReturn)
    ? investmentInputs.stockMarketReturn.baseline
    : investmentInputs.stockMarketReturn;
  const baselinePropertyGrowth = isScenarioValue(investmentInputs.propertyGrowthRate)
    ? investmentInputs.propertyGrowthRate.baseline
    : investmentInputs.propertyGrowthRate;

  // Run iterations
  for (let i = 0; i < iterations; i++) {
    // Generate correlated samples for key variables
    const samples = generateCorrelatedSamples({
      interestRate: baselineInterestRate,
      rentIncreaseRate: baselineRentIncrease,
      stockMarketReturn: baselineStockReturn,
      propertyGrowthRate: baselinePropertyGrowth,
    });

    // Create modified inputs with sampled values
    const sampledPropertyInputs: PropertyInputs = {
      ...propertyInputs,
      interestRate: samples.interestRate,
    };

    const sampledRentInputs: RentInputs = {
      ...rentInputs,
      rentIncreaseRate: samples.rentIncreaseRate,
    };

    const sampledInvestmentInputs: InvestmentInputs = {
      ...investmentInputs,
      stockMarketReturn: samples.stockMarketReturn,
      propertyGrowthRate: samples.propertyGrowthRate,
    };

    // Run comparison with sampled values
    const results = runComparison(
      sampledPropertyInputs,
      sampledRentInputs,
      sampledInvestmentInputs,
      years
    );

    // Store time series data for percentile bands
    results.forEach((snapshot) => {
      timeSeriesData.rentValues[snapshot.year].push(snapshot.rentNetPositionAfterTax);
      timeSeriesData.buyValues[snapshot.year].push(snapshot.mortgageNetPositionAfterSale);
    });

    // Store final outcome (positive = rent better)
    const finalResult = results[results.length - 1];
    const difference = finalResult.rentNetPositionAfterTax - finalResult.mortgageNetPositionAfterSale;
    outcomes.push(difference);
  }

  // Sort outcomes for percentile calculations
  const sortedOutcomes = [...outcomes].sort((a, b) => a - b);

  // Calculate probabilities
  const rentBetterCount = outcomes.filter((o) => o > 0).length;
  const rentBetterProbability = rentBetterCount / iterations;
  const buyBetterProbability = 1 - rentBetterProbability;

  // Calculate expected value
  const expectedAdvantage = outcomes.reduce((sum, val) => sum + val, 0) / iterations;

  // Calculate percentiles
  const percentiles = {
    p10: percentile(sortedOutcomes, 10),
    p25: percentile(sortedOutcomes, 25),
    p50: percentile(sortedOutcomes, 50),
    p75: percentile(sortedOutcomes, 75),
    p90: percentile(sortedOutcomes, 90),
  };

  // Create histogram (20 bins)
  const numBins = 20;
  const minOutcome = sortedOutcomes[0];
  const maxOutcome = sortedOutcomes[sortedOutcomes.length - 1];
  const binWidth = (maxOutcome - minOutcome) / numBins;

  const histogram = Array.from({ length: numBins }, (_, i) => {
    const binStart = minOutcome + i * binWidth;
    const binEnd = binStart + binWidth;
    const count = outcomes.filter((o) => o >= binStart && (i === numBins - 1 ? o <= binEnd : o < binEnd)).length;
    return {
      binStart,
      binEnd,
      count,
      probability: count / iterations,
    };
  });

  // Calculate time series percentiles
  const timeSeriesPercentiles = Array.from({ length: years + 1 }, (_, year) => {
    const rentSorted = [...timeSeriesData.rentValues[year]].sort((a, b) => a - b);
    const buySorted = [...timeSeriesData.buyValues[year]].sort((a, b) => a - b);

    return {
      year,
      rentP10: percentile(rentSorted, 10),
      rentP50: percentile(rentSorted, 50),
      rentP90: percentile(rentSorted, 90),
      buyP10: percentile(buySorted, 10),
      buyP50: percentile(buySorted, 50),
      buyP90: percentile(buySorted, 90),
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
