import type { PropertyInputs, RentInputs, InvestmentInputs, YearlySnapshot, ScenarioValue, ScenarioResults } from '../types';

export function isScenarioValue(value: number | ScenarioValue): value is ScenarioValue {
  return typeof value === 'object' && 'pessimistic' in value && 'baseline' in value && 'optimistic' in value;
}

export function resolveScenarioValue(
  value: number | ScenarioValue,
  scenario: 'pessimistic' | 'baseline' | 'optimistic'
): number {
  return isScenarioValue(value) ? value[scenario] : value;
}

export function calculateMortgagePayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

export function calculateAmortization(
  principal: number,
  annualRate: number,
  years: number,
  monthlyPayment: number,
  offsetBalance: number
): { balance: number; totalPaid: number; equity: number; totalInterest: number; totalPrincipal: number }[] {
  const monthlyRate = annualRate / 100 / 12;
  let balance = principal;
  let totalPaid = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  const schedule = [];

  for (let month = 0; month <= years * 12; month++) {
    if (month > 0 && balance > 0) {
      const effectiveBalance = Math.max(0, balance - offsetBalance);
      const interestPayment = effectiveBalance * monthlyRate;
      const principalPayment = Math.min(monthlyPayment - interestPayment, balance);

      balance = balance - principalPayment;
      totalPaid += interestPayment + principalPayment;
      totalInterest += interestPayment;
      totalPrincipal += principalPayment;
    }

    if (month % 12 === 0) {
      schedule.push({
        balance,
        totalPaid,
        equity: principal - balance,
        totalInterest,
        totalPrincipal,
      });
    }
  }

  return schedule;
}

function calculateFrankingCredits(
  portfolioValue: number,
  dividendYield: number,
  frankingLevel: number,
  marginalTaxRate: number
): {
  grossDividends: number;
  frankingCredits: number;
  taxOnDividends: number;
  netDividends: number;
  frankingBenefit: number;
} {
  const companyTaxRate = 30;
  const cashDividends = portfolioValue * (dividendYield / 100);
  const frankedDividends = cashDividends * (frankingLevel / 100);
  const frankingCredits = (frankedDividends / (1 - companyTaxRate / 100)) * (companyTaxRate / 100);
  const grossDividends = cashDividends + frankingCredits;
  const taxOnDividends = grossDividends * (marginalTaxRate / 100);
  const netTaxPosition = taxOnDividends - frankingCredits;
  const additionalTax = netTaxPosition > 0 ? netTaxPosition : 0;
  const netDividends = cashDividends - additionalTax;

  const frankingBenefit = marginalTaxRate > companyTaxRate
    ? frankingCredits
    : frankingCredits - Math.abs(netTaxPosition);

  return {
    grossDividends,
    frankingCredits,
    taxOnDividends,
    netDividends,
    frankingBenefit,
  };
}

export function runComparison(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number
): YearlySnapshot[] {
  // Ensure we have numeric values (for when called directly or from scenario comparison)
  const interestRate = typeof propertyInputs.interestRate === 'number'
    ? propertyInputs.interestRate
    : propertyInputs.interestRate.baseline;
  const rentIncreaseRate = typeof rentInputs.rentIncreaseRate === 'number'
    ? rentInputs.rentIncreaseRate
    : rentInputs.rentIncreaseRate.baseline;
  const stockMarketReturn = typeof investmentInputs.stockMarketReturn === 'number'
    ? investmentInputs.stockMarketReturn
    : investmentInputs.stockMarketReturn.baseline;
  const propertyGrowthRate = typeof investmentInputs.propertyGrowthRate === 'number'
    ? investmentInputs.propertyGrowthRate
    : investmentInputs.propertyGrowthRate.baseline;

  const loanAmount = propertyInputs.propertyPrice - propertyInputs.deposit;
  const monthlyMortgage = calculateMortgagePayment(
    loanAmount,
    interestRate,
    propertyInputs.loanTerm
  );

  const amortization = calculateAmortization(
    loanAmount,
    interestRate,
    propertyInputs.loanTerm,
    monthlyMortgage,
    propertyInputs.offsetAccountBalance ?? 0
  );

  const upfrontCosts = propertyInputs.stampDuty + propertyInputs.otherPurchaseCosts;
  const initialCapital = propertyInputs.deposit + upfrontCosts;
  const transactionCostRate = investmentInputs.stockTransactionCost / 100;
  const initialInvestmentAfterFees = initialCapital * (1 - transactionCostRate);

  const results: YearlySnapshot[] = [];
  let rentInvestment = initialInvestmentAfterFees;
  let cumulativeRent = 0;
  let currentRent = rentInputs.monthlyRent;
  let cumulativeMaintenance = 0;
  let cumulativeRates = 0;
  let cumulativeMovingCosts = 0;
  let cumulativeOwnerInsurance = 0;
  let cumulativeRenterInsurance = 0;
  let cumulativeFrankingCredits = 0;
  let cumulativeDividends = 0;

  const dividendYield = investmentInputs.dividendYield ?? 0;
  const frankingLevel = investmentInputs.frankingLevel ?? 0;
  const dividendReinvestment = investmentInputs.dividendReinvestment ?? true;
  const monthlyStockReturn = stockMarketReturn / 100 / 12;

  for (let year = 0; year <= years; year++) {
    const propertyValue =
      propertyInputs.propertyPrice *
      Math.pow(1 + propertyGrowthRate / 100, year);

    const mortgageData = amortization[year];
    const annualMaintenance = propertyValue * (propertyInputs.maintenanceRate / 100);
    const annualRates =
      year === 0
        ? propertyInputs.councilRates
        : propertyInputs.councilRates *
          Math.pow(1 + investmentInputs.inflationRate / 100, year);

    const annualBuildingInsurance =
      year === 0
        ? propertyInputs.buildingInsurance
        : propertyInputs.buildingInsurance *
          Math.pow(1 + investmentInputs.inflationRate / 100, year);

    const annualOwnerContentsInsurance =
      year === 0
        ? propertyInputs.contentsInsurance
        : propertyInputs.contentsInsurance *
          Math.pow(1 + investmentInputs.inflationRate / 100, year);

    const annualRenterInsurance =
      year === 0
        ? rentInputs.contentsInsurance
        : rentInputs.contentsInsurance *
          Math.pow(1 + investmentInputs.inflationRate / 100, year);

    if (year > 0) {
      cumulativeMaintenance += annualMaintenance;
      cumulativeRates += annualRates;
      cumulativeOwnerInsurance += annualBuildingInsurance + annualOwnerContentsInsurance;
      cumulativeRenterInsurance += annualRenterInsurance;

      if (year % rentInputs.movingFrequency === 0) {
        cumulativeMovingCosts += rentInputs.movingCost;
      }
    }

    const totalOwnershipCosts =
      upfrontCosts +
      mortgageData.totalPaid +
      cumulativeMaintenance +
      cumulativeRates +
      cumulativeOwnerInsurance;

    const mortgageNetPosition = propertyValue - mortgageData.balance - totalOwnershipCosts;
    const sellingCosts = propertyValue * (propertyInputs.sellingCostRate / 100);
    const capitalGain = propertyValue - propertyInputs.propertyPrice;
    const discountedPropertyGain = capitalGain > 0 ? capitalGain * 0.5 : 0;
    const capitalGainsTax = discountedPropertyGain * (propertyInputs.capitalGainsTaxRate / 100);

    const mortgageNetPositionAfterSale =
      propertyValue -
      mortgageData.balance -
      totalOwnershipCosts -
      sellingCosts -
      capitalGainsTax;

    if (year > 0) {
      const monthlyOwnershipCost =
        monthlyMortgage +
        annualMaintenance / 12 +
        annualRates / 12 +
        annualBuildingInsurance / 12 +
        annualOwnerContentsInsurance / 12;

      const monthlyRenterCosts = currentRent + annualRenterInsurance / 12;
      const monthlySavings = monthlyOwnershipCost - monthlyRenterCosts;

      let yearlyDividends = 0;
      let yearlyFrankingCredits = 0;

      if (dividendYield > 0) {
        const dividendCalc = calculateFrankingCredits(
          rentInvestment,
          dividendYield,
          frankingLevel,
          investmentInputs.marginalTaxRate
        );

        yearlyDividends = dividendCalc.netDividends;
        yearlyFrankingCredits = dividendCalc.frankingBenefit;
        cumulativeDividends += yearlyDividends;
        cumulativeFrankingCredits += yearlyFrankingCredits;
      }

      for (let month = 1; month <= 12; month++) {
        rentInvestment = rentInvestment * (1 + monthlyStockReturn);
        const contributionAfterFees = monthlySavings * (1 - transactionCostRate);
        rentInvestment += contributionAfterFees;

        if (dividendReinvestment && yearlyDividends > 0) {
          const monthlyDividend = yearlyDividends / 12;
          const dividendAfterFees = monthlyDividend * (1 - transactionCostRate);
          rentInvestment += dividendAfterFees;
        }
      }

      cumulativeRent += currentRent * 12;
      currentRent = currentRent * (1 + rentIncreaseRate / 100);
    }

    const rentNetPosition =
      rentInvestment - cumulativeRent - cumulativeMovingCosts - cumulativeRenterInsurance;

    const stocksCapitalGain = rentInvestment - initialCapital - cumulativeDividends;
    let stocksCapitalGainsTax = 0;
    if (stocksCapitalGain > 0) {
      const discountedGain = stocksCapitalGain * 0.5;
      stocksCapitalGainsTax = discountedGain * (investmentInputs.marginalTaxRate / 100);
    }

    const rentNetPositionAfterTax = rentNetPosition - stocksCapitalGainsTax;

    results.push({
      year,
      mortgageEquity: mortgageData.equity,
      mortgageTotalPaid: mortgageData.totalPaid + upfrontCosts,
      mortgagePropertyValue: propertyValue,
      mortgageNetPosition,
      mortgageNetPositionAfterSale,
      mortgageMaintenance: cumulativeMaintenance,
      mortgageRates: cumulativeRates,
      mortgageInsurance: cumulativeOwnerInsurance,
      mortgageTotalInterest: mortgageData.totalInterest,
      rentTotalPaid: cumulativeRent,
      rentMovingCosts: cumulativeMovingCosts,
      rentInsurance: cumulativeRenterInsurance,
      rentInvestmentValue: rentInvestment,
      rentNetPosition,
      rentNetPositionAfterTax,
      rentDividends: cumulativeDividends,
      rentFrankingCredits: cumulativeFrankingCredits,
    });
  }

  return results;
}

export function runScenarioComparison(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number
): ScenarioResults {
  const scenarios: Array<'pessimistic' | 'baseline' | 'optimistic'> = ['pessimistic', 'baseline', 'optimistic'];

  const results: ScenarioResults = {
    pessimistic: [],
    baseline: [],
    optimistic: [],
  };

  for (const scenario of scenarios) {
    // Create resolved inputs for this scenario
    const resolvedPropertyInputs: PropertyInputs = {
      ...propertyInputs,
      interestRate: resolveScenarioValue(propertyInputs.interestRate, scenario),
    };

    const resolvedRentInputs: RentInputs = {
      ...rentInputs,
      rentIncreaseRate: resolveScenarioValue(rentInputs.rentIncreaseRate, scenario),
    };

    const resolvedInvestmentInputs: InvestmentInputs = {
      ...investmentInputs,
      stockMarketReturn: resolveScenarioValue(investmentInputs.stockMarketReturn, scenario),
      propertyGrowthRate: resolveScenarioValue(investmentInputs.propertyGrowthRate, scenario),
    };

    results[scenario] = runComparison(
      resolvedPropertyInputs,
      resolvedRentInputs,
      resolvedInvestmentInputs,
      years
    );
  }

  return results;
}
