// Land tax on residential investment land held by a resident individual (general rates, no
// trust, company, absentee or foreign surcharges), 2026–27. Read 7 Nov 2026:
// - NSW: Revenue NSW "Thresholds and rates", 2026 land tax year: $100 plus 1.6% over $1,075,000,
//   $88,036 plus 2% over the $6,571,000 premium threshold. Thresholds frozen for years after 2024.
// - VIC: SRO "Land tax rates", one schedule for the 2024–2033 land tax years: flat $500 from
//   $50k and $975 from $100k, then marginal rates ("$X to under $Y", so boundaries tax up).
// - QLD: QRO "Calculate land tax – individuals": $600k threshold, $500 plus 1% over it, etc.
// - WA: Department of Treasury and Finance "Land tax assessment" (updated 20 May 2026), plus
//   the Metropolitan Region Improvement Tax of 0.14% over $300k for Perth metro land.
// - SA: RevenueSA "Rates and thresholds" 2026–27 (gazetted 4 Jun 2026). SA indexes its thresholds
//   to the Valuer-General's average change in site values each year (+12.44% for 2026–27).
// - TAS: SRO Tasmania "Rates of land tax", from 1 Jul 2025; the 2026–27 Budget changed nothing.
// - ACT: ACT Revenue Office "How land tax is calculated", 2026–27: every rented residential
//   property pays a $1,778 fixed charge plus marginal rates on its average unimproved value,
//   from the first dollar, per property.
// - NT: no land tax (KPMG summary of the 2025 NT Budget; no official NT page could be read).
//
// Simplifications:
// - Taxable value is the market value of the land. Statutory values are mass valuations, and
//   NSW, QLD and the ACT average them over several years, so real assessments lag a rising
//   market a little. No official ratio of statutory to market values exists.
// - This is the investor's only taxable land; a second property shares the threshold, and the
//   home they live in is exempt.
// - Judgment call on the future: SA's thresholds rise with land values, as legislated; ACT's
//   charges rise with inflation, as its fixed charge does (+5% for 2026–27); NSW, VIC, QLD, WA
//   and TAS thresholds stay at today's dollar amounts, since none has a rule to index them (NSW
//   froze its threshold, VIC set its schedule to 2033). Land values that outgrow inflation
//   therefore pull more investors into land tax over time, as has happened in practice.
// "Per $100 or part" rounding is ignored.

import type { AuState } from './stampDuty';

type Bracket = [over: number, base: number, rate: number];

function scale(brackets: Bracket[], value: number, inclusive = false): number {
  let tax = 0;
  for (const [over, base, rate] of brackets) {
    if (inclusive ? value >= over : value > over) tax = base + rate * (value - over);
  }
  return tax;
}

const NSW: Bracket[] = [[1075000, 100, 0.016], [6571000, 88036, 0.02]];
const VIC: Bracket[] = [
  [50000, 500, 0], [100000, 975, 0], [300000, 1350, 0.003], [600000, 2250, 0.006],
  [1000000, 4650, 0.009], [1800000, 11850, 0.0165], [3000000, 31650, 0.0265],
];
const QLD: Bracket[] = [
  [600000, 500, 0.01], [1000000, 4500, 0.0165], [3000000, 37500, 0.0125], [5000000, 62500, 0.0175], [10000000, 150000, 0.0225],
];
const WA: Bracket[] = [
  [300000, 300, 0], [420000, 300, 0.0025], [1000000, 1750, 0.009], [1800000, 8950, 0.018], [5000000, 66550, 0.02], [11000000, 186550, 0.0267],
];
const WA_MRIT: Bracket[] = [[300000, 0, 0.0014]];
const SA: Bracket[] = [[936000, 0, 0.005], [1504000, 2840, 0.01], [2188000, 9680, 0.02], [3504000, 36000, 0.024]];
const TAS: Bracket[] = [[125000, 50, 0.0045], [500000, 1737.5, 0.015]];
const ACT_FIXED = 1778;
const ACT: Bracket[] = [[0, 0, 0.0054], [150000, 810, 0.0064], [275000, 1610, 0.0124], [1000000, 10600, 0.0125], [2000000, 23100, 0.0126]];

/** Land tax for a year at today's schedules (2026–27) on a land value in today's thresholds. */
export function landTaxToday(state: AuState, landValue: number): number {
  switch (state) {
    case 'NSW': return scale(NSW, landValue);
    case 'VIC': return scale(VIC, landValue, true);
    case 'QLD': return scale(QLD, landValue);
    // Assumes Perth metro land; regional WA pays no MRIT
    case 'WA': return scale(WA, landValue) + scale(WA_MRIT, landValue);
    case 'SA': return scale(SA, landValue);
    case 'TAS': return scale(TAS, landValue);
    case 'ACT': return ACT_FIXED + scale(ACT, landValue);
    case 'NT': return 0;
  }
}

/**
 * Land tax in a future year. `landIndex` is how far land values have grown since today and
 * `cpi` how far prices have; thresholds move as described in the header.
 */
export function landTax(state: AuState, landValue: number, landIndex: number, cpi: number): number {
  if (state === 'SA') return landTaxToday(state, landValue / landIndex) * landIndex;
  if (state === 'ACT') return landTaxToday(state, landValue / cpi) * cpi;
  return landTaxToday(state, landValue);
}
