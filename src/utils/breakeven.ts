import type { PropertyInputs, RentInputs, InvestmentInputs, BreakEvenResult, BreakEvenResults } from '../types';
import { runComparison, finalAdvantage, getMetricValue, withMetric } from './calculations';

export type { BreakEvenResult, BreakEvenResults } from '../types';

/**
 * Calculate the wealth difference (Rent - Buy) at a specific parameter value
 */
function calculateDifference(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number,
  metricKey: string,
  value: number
): number {
  return finalAdvantage(
    runComparison(...withMetric(propertyInputs, rentInputs, investmentInputs, metricKey, value), years)
  );
}

/**
 * Binary search to find the break-even value for a given metric
 */
function findBreakEven(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number,
  metricKey: string,
  minValue: number,
  maxValue: number,
  tolerance: number = 1000 // Within $1k is close enough
): number | null {
  const maxIterations = 50;
  let iteration = 0;

  // Check if break-even exists in range
  const minDiff = calculateDifference(propertyInputs, rentInputs, investmentInputs, years, metricKey, minValue);
  const maxDiff = calculateDifference(propertyInputs, rentInputs, investmentInputs, years, metricKey, maxValue);

  // If same sign, no break-even in this range
  if ((minDiff > 0 && maxDiff > 0) || (minDiff < 0 && maxDiff < 0)) {
    return null;
  }

  let low = minValue;
  let high = maxValue;

  while (iteration < maxIterations && (high - low) > 0.01) {
    const mid = (low + high) / 2;
    const diff = calculateDifference(propertyInputs, rentInputs, investmentInputs, years, metricKey, mid);

    if (Math.abs(diff) < tolerance) {
      return mid;
    }

    // Standard binary search: we know minDiff and maxDiff have opposite signs
    // If diff has same sign as minDiff, move low up; otherwise move high down
    if ((diff > 0 && minDiff > 0) || (diff < 0 && minDiff < 0)) {
      low = mid;
    } else {
      high = mid;
    }

    iteration++;
  }

  return (low + high) / 2;
}

/**
 * Get reasonable search range for a given metric
 */
function getSearchRange(metricKey: string, currentValue: number): [number, number] {
  switch (metricKey) {
    case 'interestRate':
      return [0.5, 15]; // 0.5% to 15%
    case 'maintenanceRate':
      return [0, 5]; // 0% to 5%
    case 'monthlyRent':
      return [currentValue * 0.3, currentValue * 3]; // ±70% to 3x
    case 'rentIncreaseRate':
      return [0, 10]; // 0% to 10%
    case 'stockMarketReturn':
      return [-2, 20]; // -2% to 20%
    case 'propertyGrowthRate':
      return [-2, 15]; // -2% to 15%
    case 'dividendYield':
      return [0, 8]; // 0% to 8%
    case 'investedShare':
      return [0, 100];
    default:
      return [0, 100];
  }
}

/**
 * Get metric label for display
 */
function getMetricLabel(metricKey: string): string {
  switch (metricKey) {
    case 'interestRate':
      return 'Mortgage rate';
    case 'maintenanceRate':
      return 'Maintenance';
    case 'monthlyRent':
      return 'Starting rent';
    case 'rentIncreaseRate':
      return 'Rent growth';
    case 'stockMarketReturn':
      return 'Share returns';
    case 'propertyGrowthRate':
      return 'Property growth';
    case 'dividendYield':
      return 'Dividend yield';
    case 'investedShare':
      return 'Saving invested';
    default:
      return metricKey;
  }
}

/**
 * Format value for display based on metric type
 */
function formatValue(metricKey: string, value: number): string {
  if (metricKey === 'monthlyRent') {
    return `$${Math.round(value).toLocaleString('en-AU')}`;
  }
  return `${value.toFixed(2)}%`;
}

/**
 * Generate interpretation text
 */
function getInterpretation(
  metricKey: string,
  currentValue: number,
  breakEvenValue: number | null,
  currentFavorsBuy: boolean
): string {
  if (breakEvenValue === null) {
    return currentFavorsBuy
      ? `Buying is better across the entire plausible range`
      : `Renting is better across the entire plausible range`;
  }

  const formattedBreakEven = formatValue(metricKey, breakEvenValue);
  const formattedCurrent = formatValue(metricKey, currentValue);

  if (currentFavorsBuy) {
    if (currentValue < breakEvenValue) {
      return `Currently ${formattedCurrent} favors buying. Renting becomes better above ${formattedBreakEven}`;
    } else {
      return `Currently ${formattedCurrent} favors buying. Renting becomes better below ${formattedBreakEven}`;
    }
  } else {
    if (currentValue < breakEvenValue) {
      return `Currently ${formattedCurrent} favors renting. Buying becomes better above ${formattedBreakEven}`;
    } else {
      return `Currently ${formattedCurrent} favors renting. Buying becomes better below ${formattedBreakEven}`;
    }
  }
}

/**
 * Calculate break-even analysis for all key metrics
 */
export function calculateBreakEven(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number
): BreakEvenResults {
  const currentDifference = finalAdvantage(runComparison(propertyInputs, rentInputs, investmentInputs, years));
  const currentFavorsBuy = currentDifference < 0;

  const metrics = [
    'interestRate',
    'maintenanceRate',
    'monthlyRent',
    'rentIncreaseRate',
    'stockMarketReturn',
    'propertyGrowthRate',
    'dividendYield',
    'investedShare',
  ].map((key) => ({ key, current: getMetricValue(propertyInputs, rentInputs, investmentInputs, key) }));

  const results: BreakEvenResult[] = metrics.map(({ key, current }) => {
    const [min, max] = getSearchRange(key, current);
    const breakEvenValue = findBreakEven(
      propertyInputs,
      rentInputs,
      investmentInputs,
      years,
      key,
      min,
      max
    );

    const interpretation = getInterpretation(key, current, breakEvenValue, currentFavorsBuy);

    return {
      metricKey: key,
      metric: getMetricLabel(key),
      currentValue: current,
      breakEvenValue,
      exists: breakEvenValue !== null,
      currentFavorsBuy,
      interpretation,
    };
  });

  return {
    results,
    timeHorizon: years,
  };
}
