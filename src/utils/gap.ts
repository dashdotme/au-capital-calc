import type { PropertyInputs, YearlySnapshot } from '../types';

export interface GapDriver {
  key: string;
  label: string;
  /** Positive helps buying, negative helps renting */
  amount: number;
}

/**
 * Split buy-minus-rent net worth into what drove it. Both households start with the same
 * capital and spend the same each month, so the gap is exactly:
 *   home price growth − sale costs − purchase costs − interest − owner running costs
 *   + rent costs avoided − (renter's investment growth − buyer's investment growth)
 * `deflator` converts the input-based (year 0) amounts when the snapshot is in today's dollars.
 */
export function explainGap(s: YearlySnapshot, property: PropertyInputs, deflator = 1): GapDriver[] {
  const price = property.propertyPrice / deflator;
  const purchaseCosts = (property.stampDuty + property.otherPurchaseCosts + (property.lmi ?? 0)) / deflator;
  const offset = s.mortgageNetPosition - s.mortgageEquity - s.mortgageInvestmentValue;
  const homeAfterSale = s.mortgagePropertyValue - s.mortgageSaleCosts - s.mortgageLoanBalance;
  const buyerPortfolioAfterTax = s.mortgageNetPositionAfterSale - homeAfterSale - offset;
  const buyerGrowth = buyerPortfolioAfterTax - s.mortgageContributions;
  const renterGrowth = s.rentNetPositionAfterTax - s.rentContributions;

  return [
    { key: 'growth', label: 'Home price growth', amount: s.mortgagePropertyValue - price },
    { key: 'rent', label: 'Rent, moving and insurance avoided', amount: s.rentTotalPaid + s.rentMovingCosts + s.rentInsurance },
    { key: 'interest', label: 'Mortgage interest', amount: -s.mortgageTotalInterest },
    { key: 'running', label: 'Maintenance, rates and insurance', amount: -(s.mortgageMaintenance + s.mortgageRates + s.mortgageInsurance) },
    { key: 'purchase', label: 'Stamp duty and purchase costs', amount: -purchaseCosts },
    { key: 'sale', label: 'Selling costs', amount: -s.mortgageSaleCosts },
    { key: 'investing', label: "Renter's extra investment growth", amount: buyerGrowth - renterGrowth },
  ];
}
