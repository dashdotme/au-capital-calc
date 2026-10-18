import type { PropertyInputs, RentInputs } from './types';
import type { AuState } from './utils/stampDuty';
import { withPurchaseCosts } from './utils/homeBuyerSupport';

/**
 * Location presets:
 * - Price: median dwelling value (all dwellings) from Cotality's Home Value Index at 30 Sep 2026.
 * - Rent: Cotality's median weekly rent for all dwellings, June quarter 2026 (Quarterly
 *   Rental Review; Adelaide, Canberra and the combined capitals via a summary of the same
 *   release), ×52/12. Median rents rather than price × gross yield, which ranks cities
 *   differently (it put Darwin above Sydney).
 * - Building insurance: Finity's average home insurance premium by capital, Oct 2025 (as
 *   reported by ABC News, Feb 2026); the combined capitals use its national average.
 * - Council + water: rough per-city estimates (CTM Jun 2026).
 * - Median household income: ABS 2021 Census median (Greater Capital City areas), projected
 *   to 2026 with the Wage Price Index (Sep 2021 → Jun 2026, ×1.176); the combined-capitals
 *   figure is a dwelling-weighted average of the city medians.
 * Stamp duty is calculated from the price under the city's state rules (see
 * utils/stampDuty.ts); the combined capitals use a fixed average.
 */
export interface CityPreset {
  id: string;
  name: string;
  state: AuState | 'avg';
  price: number;
  monthlyRent: number;
  councilAndWater: number;
  buildingInsurance: number;
  /** Median gross household income, 2026 estimate */
  medianHouseholdIncome: number;
}

export const CITIES: CityPreset[] = [
  { id: 'capitals', name: 'Combined capitals', state: 'avg', price: 975000, monthlyRent: 3202, councilAndWater: 3100, buildingInsurance: 2938, medianHouseholdIncome: 117470 },
  { id: 'sydney', name: 'Sydney', state: 'NSW', price: 1198596, monthlyRent: 3644, councilAndWater: 2450, buildingInsurance: 3964, medianHouseholdIncome: 127013 },
  { id: 'melbourne', name: 'Melbourne', state: 'VIC', price: 780550, monthlyRent: 2778, councilAndWater: 2850, buildingInsurance: 2520, medianHouseholdIncome: 116250 },
  { id: 'brisbane', name: 'Brisbane', state: 'QLD', price: 1048880, monthlyRent: 3181, councilAndWater: 3000, buildingInsurance: 3872, medianHouseholdIncome: 113070 },
  { id: 'perth', name: 'Perth', state: 'WA', price: 975022, monthlyRent: 3397, councilAndWater: 3650, buildingInsurance: 2203, medianHouseholdIncome: 114048 },
  { id: 'adelaide', name: 'Adelaide', state: 'SA', price: 928560, monthlyRent: 2869, councilAndWater: 2950, buildingInsurance: 2042, medianHouseholdIncome: 94663 },
  { id: 'canberra', name: 'Canberra', state: 'ACT', price: 861744, monthlyRent: 3059, councilAndWater: 4750, buildingInsurance: 2622, medianHouseholdIncome: 145114 },
  { id: 'hobart', name: 'Hobart', state: 'TAS', price: 741496, monthlyRent: 2739, councilAndWater: 3250, buildingInsurance: 2268, medianHouseholdIncome: 94296 },
  { id: 'darwin', name: 'Darwin', state: 'NT', price: 633431, monthlyRent: 3142, councilAndWater: 3200, buildingInsurance: 4015, medianHouseholdIncome: 135085 },
];

/** Round to a tidy figure so the inputs read like something a person would type. */
const tidy = (value: number, step: number) => Math.round(value / step) * step;

/** Stamp duty for the combined-capitals preset, which has no single state's rules */
const AVERAGE_STAMP_DUTY = 40000;

export function applyCity(property: PropertyInputs, rent: RentInputs, city: CityPreset): [PropertyInputs, RentInputs] {
  const price = tidy(city.price, 5000);
  const state = city.state === 'avg' ? undefined : city.state;
  return [
    withPurchaseCosts({
      ...property,
      location: city.id,
      propertyPrice: price,
      deposit: tidy(price * 0.2, 1000),
      state,
      stampDuty: state ? property.stampDuty : AVERAGE_STAMP_DUTY,
      councilRates: city.councilAndWater,
      buildingInsurance: city.buildingInsurance,
    }),
    { ...rent, monthlyRent: tidy(city.monthlyRent, 10) },
  ];
}
