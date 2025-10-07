export interface FocusRange {
  extremeLow: number;
  moderateLow: number;
  baseline: number;
  moderateHigh: number;
  extremeHigh: number;
}

export function calculateFocusRange(metricKey: string, baselineValue: number): FocusRange {
  switch (metricKey) {
    case 'interestRate':
      return {
        extremeLow: 2.5,
        moderateLow: 3.5,
        baseline: baselineValue,
        moderateHigh: 5.5,
        extremeHigh: 7,
      };

    case 'rentIncreaseRate':
      return {
        extremeLow: 0,
        moderateLow: 2,
        baseline: baselineValue,
        moderateHigh: 4,
        extremeHigh: 6,
      };

    case 'stockMarketReturn':
      return {
        extremeLow: 4,
        moderateLow: 6,
        baseline: baselineValue,
        moderateHigh: 10,
        extremeHigh: 12,
      };

    case 'propertyGrowthRate':
      return {
        extremeLow: 2,
        moderateLow: 3,
        baseline: baselineValue,
        moderateHigh: 6,
        extremeHigh: 8,
      };

    case 'maintenanceRate':
      return {
        extremeLow: 0.5,
        moderateLow: 0.75,
        baseline: baselineValue,
        moderateHigh: 1.75,
        extremeHigh: 2.5,
      };

    case 'dividendYield':
      return {
        extremeLow: 0,
        moderateLow: 1,
        baseline: baselineValue,
        moderateHigh: 3,
        extremeHigh: 4,
      };

    case 'monthlyRent':
      return {
        extremeLow: Math.max(1000, baselineValue * 0.67),
        moderateLow: Math.max(1500, baselineValue * 0.83),
        baseline: baselineValue,
        moderateHigh: baselineValue * 1.17,
        extremeHigh: baselineValue * 1.33,
      };

    default:
      // Generic percentage-based range
      return {
        extremeLow: baselineValue * 0.5,
        moderateLow: baselineValue * 0.75,
        baseline: baselineValue,
        moderateHigh: baselineValue * 1.25,
        extremeHigh: baselineValue * 1.5,
      };
  }
}

export function getMetricLabel(metricKey: string): string {
  const labels: Record<string, string> = {
    interestRate: 'Interest Rate',
    rentIncreaseRate: 'Rent Increase Rate',
    stockMarketReturn: 'Stock Market Return',
    propertyGrowthRate: 'Property Growth Rate',
    maintenanceRate: 'Maintenance Rate',
    dividendYield: 'Dividend Yield',
    monthlyRent: 'Monthly Rent',
  };
  return labels[metricKey] || metricKey;
}

export function getMetricUnit(metricKey: string): string {
  if (metricKey === 'monthlyRent') {
    return '$';
  }
  return '%';
}

export function formatCompactValue(value: number, unit: string): string {
  if (unit === '$') {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}m`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${Math.round(value)}`;
  }
  return `${value}${unit}`;
}
