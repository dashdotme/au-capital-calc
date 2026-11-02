import type { PropertyInputs, YearlySnapshot } from '../types';
import { upfrontCostsOf } from './calculations';

export interface GapDriver {
  key: string;
  label: string;
  /** Positive helps buying, negative helps renting */
  amount: number;
}

/** Cash in the buyer's offset account: net worth less home equity, shares and super. */
export const offsetOf = (s: YearlySnapshot) =>
  s.mortgageNetPosition - s.mortgageEquity - s.mortgageInvestmentValue - s.mortgageSuperValue;

/** Owner running costs: maintenance, council rates, strata and insurance. */
export const runningCostsOf = (s: YearlySnapshot) =>
  s.mortgageMaintenance + s.mortgageRates + s.mortgageStrata + s.mortgageInsurance;

/**
 * Split buy-minus-rent net worth into what drove it. Both households start with the same
 * capital and spend the same each month, so the gap is exactly:
 *   home price growth − sale costs − purchase costs − owner move costs − interest
 *   − owner running costs + rent costs avoided + (buyer's pension − renter's pension and rent assistance)
 *   − (renter's investment growth − buyer's investment growth, shares and super)
 *   + (savings the renter spent − savings the buyer spent)
 * `deflator` converts the input-based (year 0) amounts when the snapshot is in today's dollars.
 */
export function explainGap(s: YearlySnapshot, property: PropertyInputs, deflator = 1): GapDriver[] {
  const price = property.propertyPrice / deflator;
  const purchaseCosts = (upfrontCostsOf(property) + (property.lmi ?? 0)) / deflator;
  const offset = offsetOf(s);
  const homeAfterSale = s.mortgagePropertyValue - s.mortgageSaleCosts - s.mortgageLoanBalance;
  const buyerPortfolioAfterTax = s.mortgageNetPositionAfterSale - homeAfterSale - offset;
  const buyerGrowth = buyerPortfolioAfterTax - s.mortgageContributions;
  const renterGrowth = s.rentNetPositionAfterTax - s.rentContributions;

  return [
    { key: 'growth', label: 'Home price growth', amount: s.mortgagePropertyValue - price },
    { key: 'rent', label: 'Rent, moving and insurance avoided', amount: s.rentTotalPaid + s.rentMovingCosts + s.rentInsurance },
    { key: 'interest', label: 'Mortgage interest', amount: -s.mortgageTotalInterest },
    { key: 'running', label: s.mortgageStrata > 0.5 ? 'Maintenance, rates, strata and insurance' : 'Maintenance, rates and insurance', amount: -runningCostsOf(s) },
    // Only when the owner moves house during the horizon
    ...(s.mortgageMoveCosts > 0.5
      ? [{ key: 'moves', label: 'Moving house (selling, stamp duty, removalists)', amount: -s.mortgageMoveCosts }]
      : []),
    { key: 'purchase', label: (property.firstHomeGrant ?? 0) > 0 ? 'Purchase costs, less the grant' : 'Stamp duty and purchase costs', amount: -purchaseCosts },
    { key: 'sale', label: 'Selling costs', amount: -s.mortgageSaleCosts },
    // Only when the horizon reaches pension age
    ...(s.mortgagePension + s.rentPension > 0.5
      ? [{ key: 'pension', label: 'Age pension (home exempt from the assets test)', amount: s.mortgagePension - s.rentPension }]
      : []),
    { key: 'investing', label: "Renter's extra investment growth", amount: buyerGrowth - renterGrowth },
    // Only when some of the monthly saving is spent rather than invested
    ...(s.rentSpent + s.mortgageSpent > 0.5
      ? [{ key: 'spent', label: 'Savings spent, not invested', amount: s.rentSpent - s.mortgageSpent }]
      : []),
  ];
}
