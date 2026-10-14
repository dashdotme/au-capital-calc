import type { PropertyInputs, RentInputs } from '../types';
import { CITIES } from '../cities';
import { resolveScenarioValue } from './calculations';

/**
 * Price-to-income sanity check: how many years of the local median household income the
 * home would cost at the sell year. House prices can outgrow incomes for a while (falling
 * rates, looser lending), but a multiple that keeps climbing means affordability keeps
 * worsening, so very high multiples flag optimistic growth assumptions.
 */
export interface PriceToIncome {
  /** Median gross household income for the area, today */
  income: number;
  /** City name the income belongs to (falls back to the combined capitals) */
  area: string;
  /** Assumed yearly income growth, % (tracks rent growth, as rents follow incomes) */
  incomeGrowth: number;
  now: number;
  atSale: number;
  stretched: boolean;
}

/** The highest multiple an Australian capital has reached (Sydney, late 2025, Cotality) */
export const RECORD_MULTIPLE = 10;
/** How far above today's multiple counts as a meaningful worsening */
const WORSENING = 1.25;

export function priceToIncome(
  property: PropertyInputs,
  rent: RentInputs,
  homeValueAtSale: number,
  sellYear: number
): PriceToIncome {
  const city = CITIES.find((c) => c.id === property.location) ?? CITIES.find((c) => c.id === 'capitals')!;
  const incomeGrowth = resolveScenarioValue(rent.rentIncreaseRate, 'baseline');
  const incomeAtSale = city.medianHouseholdIncome * Math.pow(1 + incomeGrowth / 100, sellYear);
  const now = property.propertyPrice / city.medianHouseholdIncome;
  const atSale = homeValueAtSale / incomeAtSale;
  return {
    income: city.medianHouseholdIncome,
    area: city.id === 'capitals' && property.location !== 'capitals' ? 'the combined capitals' : city.name,
    incomeGrowth,
    now,
    atSale,
    // Warn only when growth pushes past the observed record AND well above today's level,
    // so already-expensive cities don't trigger it on their own
    stretched: atSale >= RECORD_MULTIPLE && atSale >= now * WORSENING,
  };
}
