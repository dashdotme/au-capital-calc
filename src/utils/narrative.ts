import type { BreakEvenResult, YearlySnapshot } from '../types';
import type { GapDriver } from './gap';
import { flipDistance } from './flip';
import { formatCompactCurrency, formatCurrency } from './format';

const advantage = (s: YearlySnapshot) => s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;

/** How the portfolio reads mid-sentence: "…and invest the difference in global shares". */
export const PORTFOLIO_PHRASES: Record<string, string> = {
  'high-growth': 'a high-growth fund',
  australian: 'Australian shares',
  global: 'global shares',
  us: 'US shares',
  balanced: 'a balanced fund',
  cash: 'cash savings',
};

export type Winner = 'rent' | 'buy' | 'even';

/** Within 1% of the larger net worth counts as a tie. */
export function winnerAt(s: YearlySnapshot): Winner {
  const gap = advantage(s);
  const scale = Math.max(Math.abs(s.rentNetPositionAfterTax), Math.abs(s.mortgageNetPositionAfterSale), 1);
  if (Math.abs(gap) < scale * 0.01) return 'even';
  return gap > 0 ? 'rent' : 'buy';
}

/** "Renting stays ahead the whole way." / "Buying takes the lead in year 9." */
export function describeTiming(baseline: YearlySnapshot[], sellYear: number): string {
  const winner = winnerAt(baseline[sellYear]);
  if (winner === 'even') return 'The two come out almost level.';
  const leads = (s: YearlySnapshot) => (winner === 'rent' ? advantage(s) > 0 : advantage(s) < 0);
  const years = baseline.slice(1, sellYear + 1);
  const name = winner === 'rent' ? 'Renting' : 'Buying';
  if (years.every(leads)) return `${name} stays ahead the whole way.`;
  // First year from which the winner leads through to the sell year
  let from = sellYear;
  while (from > 1 && leads(baseline[from - 1])) from--;
  return `${name} takes the lead in year ${from} and keeps it.`;
}

function percent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

/** One condition that would flip the result, phrased for a sentence. */
export function flipPhrase(result: BreakEvenResult): string | null {
  if (result.breakEvenValue === null) return null;
  const up = result.breakEvenValue > result.currentValue;
  const v = result.breakEvenValue;
  switch (result.metricKey) {
    case 'monthlyRent':
      return `rent were ${up ? 'above' : 'below'} ${formatCurrency(v)} a month`;
    case 'interestRate':
      return `mortgage rates averaged ${up ? 'above' : 'below'} ${percent(v)}`;
    case 'propertyGrowthRate':
      return `home prices grew ${up ? 'faster' : 'slower'} than ${percent(v)} a year`;
    case 'stockMarketReturn':
      return `investments returned ${up ? 'more' : 'less'} than ${percent(v)} a year`;
    case 'rentIncreaseRate':
      return `rents rose ${up ? 'faster' : 'slower'} than ${percent(v)} a year`;
    case 'maintenanceRate':
      return `upkeep cost ${up ? 'more' : 'less'} than ${percent(v)} of the home's value a year`;
    case 'dividendYield':
      return `dividend yields were ${up ? 'above' : 'below'} ${percent(v)}`;
    default:
      return null;
  }
}

/** "Buying would come out on top if rent were above $3,409 a month, or …" */
export function describeFlip(breakEvens: BreakEvenResult[], winner: Winner): string {
  if (winner === 'even') return 'Small changes to any assumption could tip it either way.';
  const phrases = breakEvens
    .filter((b) => b.breakEvenValue !== null)
    .sort((a, b) => flipDistance(a) - flipDistance(b))
    .slice(0, 2)
    .map(flipPhrase)
    .filter((p): p is string => p !== null);
  if (phrases.length === 0) return 'No single assumption, changed on its own, would flip it.';
  const loser = winner === 'rent' ? 'Buying' : 'Renting';
  return `${loser} would come out on top if ${phrases.join(', or ')}.`;
}

export interface WhyCard {
  figure: string;
  text: string;
}

/** Three plain-language reasons behind the result. */
export function whyCards(baseline: YearlySnapshot[], sellYear: number, drivers: GapDriver[]): WhyCard[] {
  const first = baseline[Math.min(1, baseline.length - 1)];
  const own = first.mortgageAnnualCost / 12;
  const rent = first.rentAnnualCost / 12;
  const ownCostsMore = own >= rent;
  const ratio = ownCostsMore ? own / Math.max(rent, 1) : rent / Math.max(own, 1);
  const howMuch = ratio >= 1.8 ? 'about twice as much' : ratio >= 1.15 ? `${Math.round((ratio - 1) * 100)}% more` : 'about the same';

  const s = baseline[sellYear];
  const winner = winnerAt(s);
  const byKey = Object.fromEntries(drivers.map((d) => [d.key, d.amount]));
  const investing = -byKey.investing; // renter's extra growth (negative means the buyer's portfolio grew more)
  const growth = byKey.growth;
  const ownerCosts = -(byKey.interest + byKey.running);
  const rentAvoided = byKey.rent;

  const cards: WhyCard[] = [
    {
      figure: `${formatCurrency(own)} vs ${formatCurrency(rent)}`,
      text: ownCostsMore
        ? `Owning costs ${howMuch} each month at the start. The renter invests the difference.`
        : `Renting costs ${howMuch} each month at the start. The owner invests the difference.`,
    },
  ];
  if (investing > growth) {
    cards.push({
      figure: `+${formatCompactCurrency(investing)}`,
      text: `Extra growth on the renter's investments, more than the home's price growth of ${formatCompactCurrency(growth)}.`,
    });
  } else {
    cards.push({
      figure: `+${formatCompactCurrency(growth)}`,
      text: `The home's price growth, more than the renter's extra investment growth of ${formatCompactCurrency(Math.max(0, investing))}.`,
    });
  }
  cards.push({
    figure: formatCompactCurrency(ownerCosts),
    text: `Interest, maintenance, rates and insurance the owner pays, against ${formatCompactCurrency(rentAvoided)} of rent ${winner === 'buy' ? 'avoided' : 'paid instead'}.`,
  });
  return cards;
}
