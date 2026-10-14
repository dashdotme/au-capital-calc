import type { PropertyInputs, RentInputs } from './types';

/**
 * Location presets: median dwelling (all dwellings) per Cotality's Home Value Index at
 * 30 Sep 2026, rent from the same index's gross yield so price and rent describe the same
 * stock. Stamp duty is the standard owner-occupier amount at that median under each
 * state's 2026 schedule (QLD home concession, ACT owner-occupier). Council + water and
 * building insurance are rough per-city estimates (CTM Jun 2026, Finity Oct 2025).
 * Median household income is the ABS 2021 Census median (Greater Capital City areas),
 * projected to 2026 with the Wage Price Index (×1.176); the combined-capitals figure is a
 * dwelling-weighted average of the city medians.
 */
export interface CityPreset {
  id: string;
  name: string;
  state: string;
  price: number;
  monthlyRent: number;
  stampDuty: number;
  councilAndWater: number;
  buildingInsurance: number;
  /** Median gross household income, 2026 estimate */
  medianHouseholdIncome: number;
}

export const CITIES: CityPreset[] = [
  { id: 'capitals', name: 'Combined capitals', state: 'avg', price: 975000, monthlyRent: 3000, stampDuty: 40000, councilAndWater: 3100, buildingInsurance: 2000, medianHouseholdIncome: 117470 },
  { id: 'sydney', name: 'Sydney', state: 'NSW', price: 1198596, monthlyRent: 3396, stampDuty: 48124, councilAndWater: 2450, buildingInsurance: 2800, medianHouseholdIncome: 127013 },
  { id: 'melbourne', name: 'Melbourne', state: 'VIC', price: 780550, monthlyRent: 2667, stampDuty: 41903, councilAndWater: 2850, buildingInsurance: 2150, medianHouseholdIncome: 116250 },
  { id: 'brisbane', name: 'Brisbane', state: 'QLD', price: 1048880, monthlyRent: 3059, stampDuty: 33661, councilAndWater: 3000, buildingInsurance: 2800, medianHouseholdIncome: 113070 },
  { id: 'perth', name: 'Perth', state: 'WA', price: 975022, monthlyRent: 3250, stampDuty: 41329, councilAndWater: 3650, buildingInsurance: 2200, medianHouseholdIncome: 114048 },
  { id: 'adelaide', name: 'Adelaide', state: 'SA', price: 928560, monthlyRent: 2786, stampDuty: 44901, councilAndWater: 2950, buildingInsurance: 2100, medianHouseholdIncome: 94663 },
  { id: 'canberra', name: 'Canberra', state: 'ACT', price: 861744, monthlyRent: 3160, stampDuty: 25801, councilAndWater: 4750, buildingInsurance: 1900, medianHouseholdIncome: 145114 },
  { id: 'hobart', name: 'Hobart', state: 'TAS', price: 741496, monthlyRent: 2719, stampDuty: 28552, councilAndWater: 3250, buildingInsurance: 2000, medianHouseholdIncome: 94296 },
  { id: 'darwin', name: 'Darwin', state: 'NT', price: 633431, monthlyRent: 3442, stampDuty: 31355, councilAndWater: 3200, buildingInsurance: 3600, medianHouseholdIncome: 135085 },
];

/** Round to a tidy figure so the inputs read like something a person would type. */
const tidy = (value: number, step: number) => Math.round(value / step) * step;

export function applyCity(property: PropertyInputs, rent: RentInputs, city: CityPreset): [PropertyInputs, RentInputs] {
  const price = tidy(city.price, 5000);
  return [
    {
      ...property,
      location: city.id,
      propertyPrice: price,
      deposit: tidy(price * 0.2, 1000),
      stampDuty: tidy(city.stampDuty, 100),
      councilRates: city.councilAndWater,
      buildingInsurance: city.buildingInsurance,
    },
    { ...rent, monthlyRent: tidy(city.monthlyRent, 10) },
  ];
}
