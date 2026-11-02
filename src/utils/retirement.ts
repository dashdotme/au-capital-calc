// Income tax, the age pension, rent assistance and super, in today's (2026) dollars. The
// engine scales every threshold and payment with inflation (`index`); that is a judgment
// call: pensions are benchmarked to wages and usually rise a little faster, while tax
// brackets aren't indexed at all.
//
// Sources, checked 2 Nov 2026:
// - Income tax: ATO resident rates (updated 13 Aug 2026) show 15% on $18,201–$45,000 for
//   2026–27; the Treasury Laws Amendment (More Cost of Living Relief) Act 2025 (No. 28 of 2025)
//   cuts it to 14% from 1 Jul 2027. Sales happen in future years, so the 2027–28 rates are
//   used: 14% / 30% / 37% / 45% over $18,200 / $45,000 / $135,000 / $190,000, plus the 2%
//   Medicare levy and the low income tax offset ($700, phasing out from $37,500 to $66,667).
//   The Medicare levy low-income reduction and the seniors and pensioners tax offset (SAPTO)
//   are left out, so tax on low incomes is somewhat overstated.
// - Age pension, Services Australia pages read 2 Nov 2026 ("How much Age Pension you can
//   get", "Assets test", "Income test", "Deeming"): maximum incl. supplements $1,237.70 a
//   fortnight single, $1,866.00 couple combined. Full-pension asset limits: homeowner $333,000
//   single / $499,000 couple; non-homeowner $600,000 / $766,000; part-pension cut-offs
//   $745,750 / $1,121,000 and $1,012,750 / $1,388,000, i.e. a $3 a fortnight taper per $1,000.
//   Deeming 1.75% on the first $66,800 single / $110,600 couple, 3.75% above. Income free area
//   $226 single / $396 couple combined a fortnight; taper 50c single, 25c each for a couple.
//   Pension age 67. All financial assets are assumed to be deemed (no account-based pensions).
// - Rent Assistance (Services Australia, no children): 75c per dollar of rent over $157.80 a
//   fortnight single / $255.80 couple, up to $223.80 / $211.00. Paid with the pension, it is
//   added to the maximum rate before the means tests ("If you get Rent Assistance with your
//   pension, your cut off point is higher").
// - Super (ATO key super rates and thresholds, 2026–27): concessional cap $32,500, employer
//   super 12%. Concessional contributions taxed 15% in the fund; fund earnings taxed 15%, with
//   a one-third CGT discount; withdrawals tax-free from 60 once retired. Division 293 (another
//   15% above $250k of income) and the 0% tax on earnings in retirement phase aren't
//   modelled.

export const PENSION_AGE = 67;
/** Super is treated as tax-free to withdraw from this age (preservation age, retired) */
export const SUPER_ACCESS_AGE = 60;
export const SUPER_CONTRIBUTIONS_TAX = 0.15;
export const SUPER_EARNINGS_TAX = 0.15;
/** Share of a super fund's capital gain that is taxed after the one-third discount */
export const SUPER_TAXABLE_GAIN = 2 / 3;

const FORTNIGHTS = 26;

/** [over, base tax, rate above] — resident rates from 2027–28 */
const BRACKETS: [number, number, number][] = [
  [0, 0, 0],
  [18200, 0, 0.14],
  [45000, 3752, 0.3],
  [135000, 30752, 0.37],
  [190000, 51102, 0.45],
];
const MEDICARE_LEVY = 0.02;

/** Low income tax offset: $700, less 5c per dollar over $37,500, then 1.5c per dollar over $45,000 */
function lito(income: number): number {
  if (income <= 37500) return 700;
  if (income <= 45000) return 700 - 0.05 * (income - 37500);
  return Math.max(0, 325 - 0.015 * (income - 45000));
}

/** Income tax plus Medicare levy on a taxable income, today's dollars. */
export function incomeTax(income: number): number {
  if (income <= 0) return 0;
  let tax = 0;
  for (const [over, base, rate] of BRACKETS) {
    if (income > over) tax = base + rate * (income - over);
  }
  return Math.max(0, tax - lito(income)) + income * MEDICARE_LEVY;
}

/**
 * Tax on a capital gain (already discounted) sold evenly over `years`, split between
 * `people`, each with `otherIncome` of other taxable income in each of those years.
 */
export function spreadGainTax(taxableGain: number, years: number, people: number, otherIncome: number): number {
  if (taxableGain <= 0) return 0;
  const n = Math.max(1, Math.round(years)) * Math.max(1, people);
  const base = Math.max(0, otherIncome);
  return n * (incomeTax(base + taxableGain / n) - incomeTax(base));
}

interface PensionTest {
  /** Rent Assistance the household would get on top of the pension, per year, nominal */
  rentAssistance?: number;
  /** Assessable assets (financial assets; the home is exempt), nominal dollars */
  assets: number;
  homeowner: boolean;
  couple: boolean;
  /** Price index: today's dollars × index = nominal dollars this year */
  index: number;
}

/**
 * Age pension per year after both means tests, nominal dollars, including any Rent
 * Assistance (which is means-tested with it). All assets are deemed financial.
 */
export function agePension({ assets, homeowner, couple, index, rentAssistance = 0 }: PensionTest): number {
  const max = (couple ? 1866.0 : 1237.7) * index + rentAssistance / FORTNIGHTS;
  const assetsFree = (homeowner ? (couple ? 499000 : 333000) : couple ? 766000 : 600000) * index;
  const byAssets = max - 0.003 * Math.max(0, assets - assetsFree);

  const deemingThreshold = (couple ? 110600 : 66800) * index;
  const deemed = 0.0175 * Math.min(assets, deemingThreshold) + 0.0375 * Math.max(0, assets - deemingThreshold);
  const incomeFree = (couple ? 396 : 226) * index;
  const byIncome = max - 0.5 * Math.max(0, deemed / FORTNIGHTS - incomeFree);

  return Math.max(0, Math.min(byAssets, byIncome)) * FORTNIGHTS;
}

/** Maximum Commonwealth Rent Assistance per year before the pension means tests, nominal dollars. */
export function rentAssistance(monthlyRent: number, couple: boolean, index: number): number {
  const rentPerFortnight = (monthlyRent * 12) / FORTNIGHTS;
  const threshold = (couple ? 255.8 : 157.8) * index;
  const max = (couple ? 211.0 : 223.8) * index;
  return Math.min(max, 0.75 * Math.max(0, rentPerFortnight - threshold)) * FORTNIGHTS;
}
