export interface PropertyInputs {
  propertyPrice: number;
  deposit: number;
  loanTerm: number;
  interestRate: number;
  stampDuty: number;
  otherPurchaseCosts: number;
  maintenanceRate: number;
  councilRates: number;
  buildingInsurance: number;
  contentsInsurance: number;
  sellingCostRate: number;
  capitalGainsTaxRate: number;
}

export interface RentInputs {
  monthlyRent: number;
  rentIncreaseRate: number;
  movingFrequency: number;
  movingCost: number;
  contentsInsurance: number;
}

export interface InvestmentInputs {
  stockMarketReturn: number;
  propertyGrowthRate: number;
  marginalTaxRate: number;
  inflationRate: number;
  stockTransactionCost: number;
}

export interface YearlySnapshot {
  year: number;
  mortgageEquity: number;
  mortgageTotalPaid: number;
  mortgagePropertyValue: number;
  mortgageNetPosition: number;
  mortgageNetPositionAfterSale: number;
  mortgageMaintenance: number;
  mortgageRates: number;
  mortgageInsurance: number;
  rentTotalPaid: number;
  rentMovingCosts: number;
  rentInsurance: number;
  rentInvestmentValue: number;
  rentNetPosition: number;
  rentNetPositionAfterTax: number;
}
