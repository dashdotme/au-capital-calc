import type { BreakEvenResult } from '../types';
import { formatCurrency } from './format';

/** Relative distance from today's value to the break-even value (Infinity if none). */
export function flipDistance(result: BreakEvenResult): number {
  if (result.breakEvenValue === null) return Infinity;
  const base = Math.abs(result.currentValue) || 1;
  return Math.abs(result.breakEvenValue - result.currentValue) / base;
}

export function formatMetricValue(result: BreakEvenResult, value: number): string {
  return result.metricKey === 'monthlyRent' ? formatCurrency(value) : `${value.toFixed(2)}%`;
}
