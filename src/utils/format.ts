export function formatCurrency(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString('en-AU')}`;
}

/** $1.2m / $350k for headlines and axis ticks. */
export function formatCompactCurrency(value: number): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}m`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/** "Rent +$120k" / "Buy +$80k" for a rent-minus-buy advantage. */
export function formatAdvantage(value: number, compact = true): string {
  const amount = compact ? formatCompactCurrency(Math.abs(value)) : formatCurrency(Math.abs(value));
  return `${value > 0 ? 'Rent' : 'Buy'} +${amount}`;
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export type InputFormat = 'currency' | 'percent' | 'years' | 'number';

export function formatInputValue(value: number, format: InputFormat): string {
  return format === 'currency' ? value.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : value.toString();
}

/** Parse a typed value, tolerating $ , % and spaces. Empty means zero; garbage means null. */
export function parseInputValue(raw: string): number | null {
  const cleaned = raw.replace(/[$,%\s]|yrs?/g, '');
  if (cleaned === '' || cleaned === '-') return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
