// Timing and the minimum tax for the capital gains tax reform in the 2026–27 Budget (law:
// Treasury Laws Amendment (Tax Reform No. 1) Act 2026). Sources in investmentProperty.ts's
// header (ATO "Tax reform – Boosting home ownership", updated 29 Jun 2026; Budget 2026–27 Tax
// Explainer). From 1 Jul 2027 the 50% discount is replaced by CPI indexation of the cost base
// and a 30% minimum tax on the real gain, for all CGT assets; gains accrued before then keep
// the discount, and the asset's value on 1 Jul 2027 becomes its cost base for the rest.
// Recipients of means-tested payments are exempt from the minimum tax.

export type TaxRules = 'reform' | 'old';

/** Minimum tax on real capital gains from 1 Jul 2027 */
export const MINIMUM_GAIN_TAX = 0.3;

/** Months from `today` until 1 Jul 2027, when the reforms start (≤ 0 once it has passed). */
export function monthsUntilReform(today: Date): number {
  return (2027 - today.getFullYear()) * 12 + (6 - today.getMonth());
}
