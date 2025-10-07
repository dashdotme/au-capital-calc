/**
 * Statistical distribution utilities for Monte Carlo simulation
 */

/**
 * Box-Muller transform to generate normally distributed random numbers
 */
export function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Generate log-normally distributed random number
 * Useful for returns that can't be negative
 */
export function randomLogNormal(meanLog: number, stdDevLog: number): number {
  const normalSample = randomNormal(meanLog, stdDevLog);
  return Math.exp(normalSample);
}

/**
 * Generate random number from triangular distribution
 * Useful when you have min, most likely, and max estimates
 */
export function randomTriangular(min: number, mode: number, max: number): number {
  const u = Math.random();
  const fc = (mode - min) / (max - min);

  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

/**
 * Clamp a value to ensure it stays within reasonable bounds
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Correlation matrix for related economic variables
 * This captures realistic co-movements between parameters
 */
export interface CorrelationMatrix {
  interestRate_rentIncrease: number;
  interestRate_stockReturn: number;
  interestRate_propertyGrowth: number;
  rentIncrease_inflation: number;
  stockReturn_propertyGrowth: number;
}

/**
 * Default correlation assumptions based on economic theory
 * Positive correlation: variables tend to move together
 * Negative correlation: variables tend to move opposite
 */
export const DEFAULT_CORRELATIONS: CorrelationMatrix = {
  interestRate_rentIncrease: 0.6,      // Higher rates → higher inflation → higher rents
  interestRate_stockReturn: -0.4,       // Higher rates → lower stock valuations
  interestRate_propertyGrowth: -0.3,    // Higher rates → lower property demand
  rentIncrease_inflation: 0.8,          // Rents track inflation closely
  stockReturn_propertyGrowth: 0.5,      // Both driven by economic growth
};

/**
 * Distribution parameters for each variable
 */
export interface DistributionParams {
  mean: number;
  stdDev: number;
  min?: number;
  max?: number;
}

/**
 * Get default distribution parameters based on baseline value
 *
 * IMPORTANT: These represent uncertainty in LONG-TERM AVERAGES over 30 years,
 * NOT year-to-year volatility. A 30-year average stock return has much less
 * variance than a single year's return.
 */
export function getDefaultDistribution(
  metricKey: string,
  baselineValue: number
): DistributionParams {
  switch (metricKey) {
    case 'interestRate':
      // Uncertainty in average interest rate over 30 years
      // Typical range: ±1.5% around baseline
      return {
        mean: baselineValue,
        stdDev: 0.6,
        min: 0.5,
        max: 12,
      };
    case 'rentIncreaseRate':
      // Uncertainty in average rent growth over 30 years
      // Closely tied to long-term inflation
      return {
        mean: baselineValue,
        stdDev: 0.5,
        min: 0,
        max: 8,
      };
    case 'stockMarketReturn':
      // Uncertainty in 30-year average stock return
      // Historical 30-year rolling averages: 8-12% with some outliers
      // Much less variance than single-year returns (which have 16-20% volatility)
      return {
        mean: baselineValue,
        stdDev: 1.5,
        min: 2,
        max: 15,
      };
    case 'propertyGrowthRate':
      // Uncertainty in 30-year average property growth
      // Lower variance than stocks, tied to local market conditions
      return {
        mean: baselineValue,
        stdDev: 1.0,
        min: 0,
        max: 10,
      };
    case 'maintenanceRate':
      // Maintenance costs relatively predictable
      return {
        mean: baselineValue,
        stdDev: 0.2,
        min: 0.2,
        max: 3,
      };
    case 'monthlyRent':
      // Initial rent: some variance based on market conditions
      return {
        mean: baselineValue,
        stdDev: baselineValue * 0.1, // 10% coefficient of variation
        min: baselineValue * 0.7,
        max: baselineValue * 1.3,
      };
    case 'dividendYield':
      // Dividend yield: relatively stable over long term
      return {
        mean: baselineValue,
        stdDev: 0.3,
        min: 0,
        max: 6,
      };
    default:
      return {
        mean: baselineValue,
        stdDev: baselineValue * 0.15,
      };
  }
}

/**
 * Apply Cholesky decomposition for correlated random variables
 * This is a simplified version that handles key correlations
 */
export function generateCorrelatedSamples(
  baselineValues: {
    interestRate: number;
    rentIncreaseRate: number;
    stockMarketReturn: number;
    propertyGrowthRate: number;
  },
  correlations: CorrelationMatrix = DEFAULT_CORRELATIONS
): {
  interestRate: number;
  rentIncreaseRate: number;
  stockMarketReturn: number;
  propertyGrowthRate: number;
} {
  // Get distribution parameters
  const interestDist = getDefaultDistribution('interestRate', baselineValues.interestRate);
  const rentDist = getDefaultDistribution('rentIncreaseRate', baselineValues.rentIncreaseRate);
  const stockDist = getDefaultDistribution('stockMarketReturn', baselineValues.stockMarketReturn);
  const propertyDist = getDefaultDistribution('propertyGrowthRate', baselineValues.propertyGrowthRate);

  // Generate independent standard normal variables
  const z1 = randomNormal(0, 1);
  const z2 = randomNormal(0, 1);
  const z3 = randomNormal(0, 1);
  const z4 = randomNormal(0, 1);

  // Apply correlations using Cholesky-like transformation
  // Interest rate (base variable)
  const interestRate = clamp(
    baselineValues.interestRate + z1 * interestDist.stdDev,
    interestDist.min!,
    interestDist.max!
  );

  // Rent increase (correlated with interest rate and independent noise)
  const rentIncreaseRate = clamp(
    baselineValues.rentIncreaseRate +
      correlations.interestRate_rentIncrease * z1 * rentDist.stdDev +
      Math.sqrt(1 - correlations.interestRate_rentIncrease ** 2) * z2 * rentDist.stdDev,
    rentDist.min!,
    rentDist.max!
  );

  // Stock return (negatively correlated with interest rate)
  const stockMarketReturn = clamp(
    baselineValues.stockMarketReturn +
      correlations.interestRate_stockReturn * z1 * stockDist.stdDev +
      Math.sqrt(1 - correlations.interestRate_stockReturn ** 2) * z3 * stockDist.stdDev,
    stockDist.min!,
    stockDist.max!
  );

  // Property growth (correlated with stocks and negatively with rates)
  const propertyGrowthRate = clamp(
    baselineValues.propertyGrowthRate +
      correlations.interestRate_propertyGrowth * z1 * propertyDist.stdDev +
      correlations.stockReturn_propertyGrowth * z3 * propertyDist.stdDev +
      Math.sqrt(
        1 -
          correlations.interestRate_propertyGrowth ** 2 -
          correlations.stockReturn_propertyGrowth ** 2
      ) *
        z4 *
        propertyDist.stdDev,
    propertyDist.min!,
    propertyDist.max!
  );

  return {
    interestRate,
    rentIncreaseRate,
    stockMarketReturn,
    propertyGrowthRate,
  };
}

/**
 * Calculate percentile from sorted array
 */
export function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  if (p <= 0) return sortedArray[0];
  if (p >= 100) return sortedArray[sortedArray.length - 1];

  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}
