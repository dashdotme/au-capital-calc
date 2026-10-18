// First home buyer support beyond stamp duty, and the derived purchase costs that depend on it.
// - First Home Owner Grants (new homes only), contracts in 2026–27:
//   NSW $10k up to $600k; VIC $10k up to $750k; QLD $30k up to $750k (kept at $30k in the
//   2026–27 Budget); WA $10k up to $750k (south of the 26th parallel); SA $15k, no cap;
//   TAS $20k, no cap (1 Jul 2026 – 30 Jun 2027); NT HomeGrown $50k up to $750k (to Sep 2027);
//   ACT none.
// - Australian Government 5% Deposit Scheme (First Home Guarantee), from 1 Oct 2025: a first
//   home buyer with at least 5% down pays no lenders mortgage insurance on a home at or below
//   the location's price cap. No income caps or place limits. Capital city caps are used.
// - Lenders mortgage insurance otherwise: a rough owner-occupier premium by LVR band, midway
//   through published Helia/QBE-style grids. Real quotes vary with loan size and insurer.
import type { PropertyInputs } from '../types';
import { calculateStampDuty, type AuState } from './stampDuty';
import { formatCurrency } from './format';
import { NEW_HOME_DRAG_YEARS, NEW_HOME_GROWTH_DRAG } from './calculations';

const GRANTS: Record<AuState, { amount: number; cap: number | null } | null> = {
  NSW: { amount: 10000, cap: 600000 },
  VIC: { amount: 10000, cap: 750000 },
  QLD: { amount: 30000, cap: 750000 },
  WA: { amount: 10000, cap: 750000 },
  SA: { amount: 15000, cap: null },
  TAS: { amount: 20000, cap: null },
  ACT: null,
  NT: { amount: 50000, cap: 750000 },
};

/** 5% Deposit Scheme price caps for capital cities (and NSW, VIC, QLD regional centres) */
export const GUARANTEE_PRICE_CAPS: Record<AuState, number> = {
  NSW: 1500000,
  VIC: 950000,
  QLD: 1000000,
  WA: 850000,
  SA: 900000,
  TAS: 700000,
  ACT: 1000000,
  NT: 750000,
};

/** Premium as a share of the loan, by the highest LVR in each band */
const LMI_BANDS: [maxLvr: number, rate: number][] = [
  [80, 0],
  [85, 0.01],
  [90, 0.02],
  [95, 0.035],
  [Infinity, 0.045],
];

/** "$750k", "$1.5m" */
const short = (v: number) => (v >= 1e6 ? `$${+(v / 1e6).toFixed(2)}m` : `$${Math.round(v / 1000)}k`);

type Purchase = Pick<PropertyInputs, 'propertyPrice' | 'deposit' | 'state' | 'firstHomeBuyer' | 'newHome'>;

export function firstHomeGrant(p: Purchase): number {
  const grant = p.state && p.firstHomeBuyer && p.newHome ? GRANTS[p.state] : null;
  if (!grant || (grant.cap !== null && p.propertyPrice > grant.cap)) return 0;
  return grant.amount;
}

/** One line on the grant for this state and buyer. */
export function grantNote(p: Purchase): string {
  if (!p.state) return 'Pick a state to see first home owner grants.';
  const grant = GRANTS[p.state];
  if (!grant) return `${p.state} has no first home owner grant.`;
  const terms = `${p.state} pays first home buyers ${short(grant.amount)} on a new home${grant.cap ? ` up to ${short(grant.cap)}` : ' at any price'}`;
  if (!p.firstHomeBuyer) return `${terms}; you've owned before.`;
  if (!p.newHome) return `${terms}; not on an established one.`;
  return firstHomeGrant(p) > 0 ? `${terms}.` : `${terms}; this price is over the cap.`;
}

export const lvrOf = (p: Pick<PropertyInputs, 'propertyPrice' | 'deposit'>) =>
  p.propertyPrice > 0 ? ((p.propertyPrice - p.deposit) / p.propertyPrice) * 100 : 0;

/** Whether the 5% Deposit Scheme waives LMI. Without a state the price cap can't be checked. */
export function guaranteeApplies(p: Purchase): boolean {
  if (!p.firstHomeBuyer || p.deposit < p.propertyPrice * 0.05) return false;
  return !p.state || p.propertyPrice <= GUARANTEE_PRICE_CAPS[p.state];
}

export function estimateLmi(p: Purchase): number {
  const lvr = lvrOf(p);
  if (lvr <= 80 || guaranteeApplies(p)) return 0;
  const [, rate] = LMI_BANDS.find(([max]) => lvr <= max)!;
  return Math.round((p.propertyPrice - p.deposit) * rate);
}

/** Why LMI is what it is, for the LMI input and deposit notes. */
export function lmiNote(p: Purchase & Pick<PropertyInputs, 'lmiEstimated'>): string {
  const lvr = lvrOf(p);
  if (lvr <= 80) return 'No LMI at 80% or below.';
  if (guaranteeApplies(p)) {
    const cap = p.state ? ` up to ${short(GUARANTEE_PRICE_CAPS[p.state])} in ${p.state} capitals` : '';
    return `Waived: the 5% Deposit Scheme covers first home buyers with 5% down${cap}.`;
  }
  const why = !p.firstHomeBuyer
    ? 'The 5% Deposit Scheme is only for first home buyers.'
    : p.deposit < p.propertyPrice * 0.05
      ? 'The 5% Deposit Scheme needs at least 5% down.'
      : `This price is over the 5% Deposit Scheme's ${p.state} cap.`;
  return p.lmiEstimated ? `${why} Rough estimate; your lender will quote the real figure.` : `${why} Entered manually.`;
}

/** Short mortgage insurance outcome for a deposit, e.g. "under 20%: about $23,275 mortgage insurance". */
export function depositNote(p: Purchase & Pick<PropertyInputs, 'lmi' | 'lmiEstimated'>): string {
  if (lvrOf(p) <= 80) return 'no mortgage insurance';
  if (guaranteeApplies(p)) return 'under 20%, but the 5% Deposit Scheme waives mortgage insurance';
  const lmi = p.lmiEstimated ? estimateLmi(p) : (p.lmi ?? 0);
  return lmi > 0 ? `under 20%: about ${formatCurrency(lmi)} mortgage insurance` : 'under 20% usually means mortgage insurance';
}

/** "New home: 1 point lower for the first 10 years." */
export const NEW_HOME_GROWTH_SHORT = `New home: ${NEW_HOME_GROWTH_DRAG} point lower for the first ${NEW_HOME_DRAG_YEARS} years.`;

export const NEW_HOME_GROWTH_NOTE =
  `New homes sell at a premium and more of the price is a building that wears out, so they grow more slowly at first. Modelled as ${NEW_HOME_GROWTH_DRAG} point a year below your growth rate for the first ${NEW_HOME_DRAG_YEARS} years, about 10% less value by then.`;

/**
 * Recalculate everything that follows from price, deposit, state and buyer: stamp duty (when
 * a state is set), the first home owner grant, and LMI (when estimated). Manual figures stay.
 */
export function withPurchaseCosts<T extends PropertyInputs>(p: T): T {
  const stampDuty = p.state ? calculateStampDuty(p.state, p.propertyPrice, p.firstHomeBuyer ?? false, p.newHome) : p.stampDuty;
  const grant = firstHomeGrant(p);
  const lmi = p.lmiEstimated ? estimateLmi(p) : p.lmi;
  if (stampDuty === p.stampDuty && grant === (p.firstHomeGrant ?? 0) && lmi === p.lmi) return p;
  return { ...p, stampDuty, firstHomeGrant: grant, lmi };
}
