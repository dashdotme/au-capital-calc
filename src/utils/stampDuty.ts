// Transfer (stamp) duty on a home bought to live in, by state, with first home buyer
// relief. Rates for contracts in 2026–27:
// - NSW: Revenue NSW 2026/27 thresholds; First Home Buyers Assistance Scheme (exempt to
//   $800k, concessional to $1m: duty rises linearly to the full amount at $1m).
// - VIC: general rates with the principal place of residence concession; first home buyers
//   exempt to $600k, sliding concession to $750k.
// - QLD: home concession rates; first home concession exempts to $700k, tapering in $10k
//   steps to nothing at $800k. First home buyers pay nothing on a new home (from 1 May 2025).
// - WA: general rates; first home owner rate (Perth and Peel, from 21 Mar 2025) exempts to
//   $500k, then $13.63 per $100 over $500k up to $700k.
// - SA: general rates; first home buyers pay nothing on a new home (from 6 Jun 2024) and
//   get no relief on an established one.
// - TAS: general rates; the established-home exemption ended for settlements after 30 Jun 2026.
// - ACT: owner-occupier rates; the Home Buyer Concession Scheme has no price or income cap
//   from 1 Jul 2026, so eligible buyers pay nothing.
// - NT: statutory formula; no duty concession for first home buyers (its help is grants).
// Elsewhere new and established homes are treated alike. Victoria's off-the-plan concession
// for apartments and townhouses depends on construction progress and isn't modelled.
// "Per $100 or part thereof" rounding is ignored, so figures can differ by a few dollars.

export type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

export const AU_STATES: AuState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export const isAuState = (value: unknown): value is AuState => AU_STATES.includes(value as AuState);

/** Duty is `base + rate × (value − over)` in the highest bracket the value exceeds. */
type Bracket = [over: number, base: number, rate: number];

function scale(brackets: Bracket[], value: number): number {
  let duty = 0;
  for (const [over, base, rate] of brackets) {
    if (value > over) duty = base + rate * (value - over);
  }
  return duty;
}

const NSW: Bracket[] = [
  [0, 0, 0.0125],
  [18000, 225, 0.015],
  [38000, 525, 0.0175],
  [103000, 1662, 0.035],
  [387000, 11602, 0.045],
  [1290000, 52237, 0.055],
  [3870000, 194137, 0.07], // premium property duty
];

// General rates, with the principal place of residence concession between $130k and $550k
const VIC: Bracket[] = [
  [0, 0, 0.014],
  [25000, 350, 0.024],
  [130000, 2870, 0.05],
  [440000, 18370, 0.06],
  [550000, 2870 + 0.06 * 420000, 0.06],
];

const vic = (value: number) => {
  if (value > 2000000) return 110000 + 0.065 * (value - 2000000);
  if (value > 960000) return 0.055 * value;
  return scale(VIC, value);
};

// Home concession rates (owner-occupier)
const QLD: Bracket[] = [
  [0, 0, 0.01],
  [350000, 3500, 0.035],
  [540000, 10150, 0.045],
  [1000000, 30850, 0.0575],
];

const WA: Bracket[] = [
  [0, 0, 0.019],
  [120000, 2280, 0.0285],
  [150000, 3135, 0.038],
  [360000, 11115, 0.0475],
  [725000, 28453, 0.0515],
];

const SA: Bracket[] = [
  [0, 0, 0.01],
  [12000, 120, 0.02],
  [30000, 480, 0.03],
  [50000, 1080, 0.035],
  [100000, 2830, 0.04],
  [200000, 6830, 0.0425],
  [250000, 8955, 0.0475],
  [300000, 11330, 0.05],
  [500000, 21330, 0.055],
];

const TAS: Bracket[] = [
  [0, 50, 0],
  [3000, 50, 0.0175],
  [25000, 435, 0.0225],
  [75000, 1560, 0.035],
  [200000, 5935, 0.04],
  [375000, 12935, 0.0425],
  [725000, 27810, 0.045],
];

// Owner-occupier rates
const ACT: Bracket[] = [
  [0, 0, 0.0028],
  [260000, 728, 0.022],
  [300000, 1608, 0.034],
  [500000, 8408, 0.0432],
  [750000, 19208, 0.059],
  [1000000, 33958, 0.064],
];

const act = (value: number) => (value > 1455000 ? 0.0454 * value : scale(ACT, value));

const nt = (value: number) => {
  if (value > 5000000) return 0.0595 * value;
  if (value > 3000000) return 0.0575 * value;
  if (value > 525000) return 0.0495 * value;
  const v = value / 1000;
  return 0.06571441 * v * v + 15 * v;
};

interface StateRules {
  name: string;
  standard: (value: number) => number;
  firstHome: (value: number) => number;
  /** First home buyer duty on a new home, where it differs from an established one */
  firstHomeNew?: (value: number) => number;
  /** What first home buyers get, in a short phrase */
  firstHomeNote: string;
}

export const STAMP_DUTY_RULES: Record<AuState, StateRules> = {
  NSW: {
    name: 'New South Wales',
    standard: (v) => scale(NSW, v),
    firstHome: (v) => (v <= 800000 ? 0 : v < 1000000 ? (scale(NSW, 1000000) * (v - 800000)) / 200000 : scale(NSW, v)),
    firstHomeNote: 'nothing up to $800k, reduced up to $1m',
  },
  VIC: {
    name: 'Victoria',
    standard: vic,
    firstHome: (v) => (v <= 600000 ? 0 : v <= 750000 ? (vic(v) * (v - 600000)) / 150000 : vic(v)),
    firstHomeNote: 'nothing up to $600k, reduced up to $750k',
  },
  QLD: {
    name: 'Queensland',
    standard: (v) => scale(QLD, v),
    firstHome: (v) => {
      if (v <= 700000) return 0;
      if (v >= 800000) return scale(QLD, v);
      const concession = 17350 - 1735 * Math.floor((v - 700000) / 10000);
      return Math.max(0, scale(QLD, v) - concession);
    },
    firstHomeNew: () => 0,
    firstHomeNote: 'nothing up to $700k, reduced up to $800k, and nothing on a new home at any price',
  },
  WA: {
    name: 'Western Australia',
    standard: (v) => scale(WA, v),
    firstHome: (v) => (v <= 500000 ? 0 : v <= 700000 ? 0.1363 * (v - 500000) : scale(WA, v)),
    firstHomeNote: 'nothing up to $500k, reduced up to $700k in Perth and Peel ($750k elsewhere)',
  },
  SA: {
    name: 'South Australia',
    standard: (v) => scale(SA, v),
    firstHome: (v) => scale(SA, v),
    firstHomeNew: () => 0,
    firstHomeNote: 'no relief on an established home, nothing on a new home at any price',
  },
  TAS: {
    name: 'Tasmania',
    standard: (v) => scale(TAS, v),
    firstHome: (v) => scale(TAS, v),
    firstHomeNote: 'no relief since the established-home exemption ended on 30 June 2026',
  },
  ACT: {
    name: 'Australian Capital Territory',
    standard: act,
    firstHome: () => 0,
    firstHomeNote: 'nothing at any price under the Home Buyer Concession Scheme (no property owned in the last 5 years)',
  },
  NT: {
    name: 'Northern Territory',
    standard: nt,
    firstHome: nt,
    firstHomeNote: 'no duty concession on established homes',
  },
};

export function calculateStampDuty(state: AuState, price: number, firstHomeBuyer: boolean, newHome = false): number {
  const rules = STAMP_DUTY_RULES[state];
  const firstHome = (newHome && rules.firstHomeNew) || rules.firstHome;
  const duty = firstHomeBuyer ? firstHome(price) : rules.standard(price);
  return Math.round(Math.max(0, duty));
}

/** One line describing how the stamp duty figure was worked out. */
export function stampDutyBasis(state: AuState | undefined, firstHomeBuyer: boolean): string {
  if (!state) return 'Entered manually. Pick a state to calculate it from the price.';
  if (!firstHomeBuyer) return `${state} owner-occupier rates, 2026–27.`;
  return `${state} first home buyers: ${STAMP_DUTY_RULES[state].firstHomeNote}.`;
}
