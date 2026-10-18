import type { PropertyInputs, RentInputs, InvestmentInputs, YearlySnapshot, ScenarioValue, ScenarioResults } from '../types';

const COMPANY_TAX_RATE = 0.3;
const CGT_DISCOUNT = 0.5;

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
  if (numPayments <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / numPayments;
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

/**
 * Optional per-year rate overrides (index 0 = year 1), used by the Monte Carlo
 * simulation to model year-to-year volatility. Missing entries fall back to the
 * constant input rate.
 */
export interface RatePaths {
  interestRate?: number[];
  stockMarketReturn?: number[];
  propertyGrowthRate?: number[];
  rentIncreaseRate?: number[];
}

/**
 * Share portfolio with an ATO-style cost base. Brokerage is paid on every buy and on
 * the final sale; dividends are taxed at the marginal rate with franking credits
 * offsetting tax (and refunded if they exceed it).
 */
export class Portfolio {
  value = 0;
  costBase = 0;
  cash = 0;
  dividends = 0;
  frankingCredits = 0;
  /** New money put in (excludes reinvested dividends), so growth = value - contributions */
  contributions = 0;
  private readonly feeRate: number;
  private readonly taxRate: number;

  constructor(feeRate: number, taxRate: number) {
    this.feeRate = feeRate;
    this.taxRate = taxRate;
  }

  /** Add new savings to the portfolio. */
  contribute(amount: number) {
    if (amount <= 0) return;
    this.contributions += amount;
    this.buy(amount);
  }

  buy(amount: number) {
    if (amount <= 0) return;
    this.value += amount * (1 - this.feeRate);
    this.costBase += amount;
  }

  /** One month of price growth plus dividends. Rates are annual decimals. */
  grow(totalReturn: number, dividendYield: number, frankingLevel: number, reinvest: boolean) {
    if (this.value <= 0) return;
    // Split the monthly total return into dividends and price growth so the pre-tax
    // compound return is exactly totalReturn regardless of yield.
    const cashDividend = this.value * (dividendYield / 12);
    const totalGrowth = Math.pow(Math.max(0, 1 + totalReturn), 1 / 12);
    this.value *= Math.max(0, totalGrowth - dividendYield / 12);

    if (cashDividend <= 0) return;
    const franking = cashDividend * frankingLevel * (COMPANY_TAX_RATE / (1 - COMPANY_TAX_RATE));
    const netTax = (cashDividend + franking) * this.taxRate - franking;
    const afterTax = cashDividend - netTax;
    this.dividends += afterTax;
    this.frankingCredits += franking;
    if (reinvest) {
      this.buy(afterTax);
    } else {
      this.cash += afterTax;
    }
  }

  holdingValue(): number {
    return this.value + this.cash;
  }

  /**
   * Sell enough to raise `needed` in cash after brokerage and discounted CGT (cash held
   * first). Returns the amount actually raised, which is less if the portfolio runs out.
   */
  withdraw(needed: number): number {
    if (needed <= 0) return 0;
    const fromCash = Math.min(Math.max(0, this.cash), needed);
    this.cash -= fromCash;
    let remaining = needed - fromCash;
    if (remaining <= 0 || this.value <= 0) return fromCash;
    const costShare = this.costBase / this.value;
    const gainPerDollar = Math.max(0, 1 - this.feeRate - costShare);
    const netPerDollar = 1 - this.feeRate - gainPerDollar * CGT_DISCOUNT * this.taxRate;
    const sold = Math.min(this.value, remaining / netPerDollar);
    this.costBase -= costShare * sold;
    this.value -= sold;
    remaining -= sold * netPerDollar;
    return needed - remaining;
  }

  /** Value if everything were sold today, after brokerage and discounted CGT. */
  liquidationValue(): number {
    const proceeds = this.value * (1 - this.feeRate);
    const gain = proceeds - this.costBase;
    const tax = gain > 0 ? gain * CGT_DISCOUNT * this.taxRate : 0;
    return proceeds - tax + this.cash;
  }
}

export function runComparison(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number,
  paths: RatePaths = {}
): YearlySnapshot[] {
  const baseInterestRate = resolveScenarioValue(propertyInputs.interestRate, 'baseline');
  const baseRentIncrease = resolveScenarioValue(rentInputs.rentIncreaseRate, 'baseline');
  const baseStockReturn = resolveScenarioValue(investmentInputs.stockMarketReturn, 'baseline');
  const basePropertyGrowth = resolveScenarioValue(investmentInputs.propertyGrowthRate, 'baseline');
  const rateFor = (path: number[] | undefined, year: number, fallback: number) =>
    path?.[year - 1] ?? fallback;

  const marginalTaxRate = investmentInputs.marginalTaxRate / 100;
  const feeRate = investmentInputs.stockTransactionCost / 100;
  const inflation = investmentInputs.inflationRate / 100;
  const dividendYield = (investmentInputs.dividendYield ?? 0) / 100;
  const frankingLevel = (investmentInputs.frankingLevel ?? 0) / 100;
  const reinvestDividends = investmentInputs.dividendReinvestment ?? true;
  const managementFee = (investmentInputs.managementFee ?? 0) / 100;
  const offset = Math.max(0, propertyInputs.offsetAccountBalance ?? 0);
  const totalMonths = Math.max(0, Math.round(propertyInputs.loanTerm * 12));

  // Both households start with the same capital: the buyer spends deposit + purchase
  // costs on the property and parks savings in the offset; the renter invests all of it.
  const upfrontCosts = upfrontCostsOf(propertyInputs);
  const startingCapital = propertyInputs.deposit + upfrontCosts + offset;
  const loanAmount = Math.max(0, propertyInputs.propertyPrice - propertyInputs.deposit + (propertyInputs.lmi ?? 0));

  const renter = new Portfolio(feeRate, marginalTaxRate);
  const buyer = new Portfolio(feeRate, marginalTaxRate);
  renter.contribute(startingCapital);

  let balance = loanAmount;
  let currentInterestRate = Number.NaN;
  let monthlyPayment = 0;
  let monthsElapsed = 0;
  let propertyValue = propertyInputs.propertyPrice;
  let monthlyRent = rentInputs.monthlyRent;

  let totalPrincipalAndInterest = 0;
  let totalInterest = 0;
  let cumulativeMaintenance = 0;
  let cumulativeRates = 0;
  let cumulativeOwnerInsurance = 0;
  let cumulativeRent = 0;
  let cumulativeMovingCosts = 0;
  let cumulativeRenterInsurance = 0;

  const results: YearlySnapshot[] = [];

  const snapshot = (year: number, mortgageAnnualCost: number, rentAnnualCost: number) => {
    const sellingCosts = propertyValue * (propertyInputs.sellingCostRate / 100);
    const propertyCostBase = propertyInputs.propertyPrice + upfrontCosts + sellingCosts;
    const propertyGain = propertyValue - propertyCostBase;
    const propertyCGT = propertyGain > 0
      ? propertyGain * CGT_DISCOUNT * (propertyInputs.capitalGainsTaxRate / 100)
      : 0;
    const equity = propertyValue - balance;

    results.push({
      year,
      mortgageEquity: equity,
      mortgageTotalPaid: upfrontCosts + totalPrincipalAndInterest,
      mortgagePropertyValue: propertyValue,
      mortgageLoanBalance: balance,
      mortgageInvestmentValue: buyer.holdingValue(),
      mortgageNetPosition: equity + offset + buyer.holdingValue(),
      mortgageNetPositionAfterSale:
        equity - sellingCosts - propertyCGT + offset + buyer.liquidationValue(),
      mortgageMaintenance: cumulativeMaintenance,
      mortgageRates: cumulativeRates,
      mortgageInsurance: cumulativeOwnerInsurance,
      mortgageTotalInterest: totalInterest,
      mortgageAnnualCost,
      mortgageContributions: buyer.contributions,
      mortgageSaleCosts: sellingCosts + propertyCGT,
      rentTotalPaid: cumulativeRent,
      rentMovingCosts: cumulativeMovingCosts,
      rentInsurance: cumulativeRenterInsurance,
      rentInvestmentValue: renter.holdingValue(),
      rentNetPosition: renter.holdingValue(),
      rentNetPositionAfterTax: renter.liquidationValue(),
      rentDividends: renter.dividends,
      rentFrankingCredits: renter.frankingCredits,
      rentAnnualCost,
      rentContributions: renter.contributions,
    });
  };

  snapshot(0, 0, 0);

  for (let year = 1; year <= years; year++) {
    const interestRate = rateFor(paths.interestRate, year, baseInterestRate);
    const stockReturn = rateFor(paths.stockMarketReturn, year, baseStockReturn) / 100 - managementFee;
    const propertyGrowth = rateFor(paths.propertyGrowthRate, year, basePropertyGrowth) / 100;
    const rentIncrease = rateFor(paths.rentIncreaseRate, year, baseRentIncrease) / 100;

    // Variable-rate loan: when the rate changes, the bank re-amortises the remaining
    // balance over the remaining term.
    if (interestRate !== currentInterestRate) {
      currentInterestRate = interestRate;
      monthlyPayment = calculateMortgagePayment(
        balance,
        interestRate,
        (totalMonths - monthsElapsed) / 12
      );
    }

    const priceIndex = Math.pow(1 + inflation, year - 1);
    const annualRates = propertyInputs.councilRates * priceIndex;
    const annualOwnerInsurance =
      (propertyInputs.buildingInsurance + propertyInputs.contentsInsurance) * priceIndex;
    const annualRenterInsurance = rentInputs.contentsInsurance * priceIndex;
    const movesThisYear = rentInputs.movingFrequency > 0 && year % rentInputs.movingFrequency === 0;
    const movingCost = movesThisYear ? rentInputs.movingCost * priceIndex : 0;
    const monthlyPropertyGrowth = Math.pow(1 + propertyGrowth, 1 / 12) - 1;

    let mortgageAnnualCost = 0;
    let rentAnnualCost = 0;

    for (let month = 1; month <= 12; month++) {
      let loanPayment = 0;
      if (balance > 0.005) {
        const interest = Math.max(0, balance - offset) * (currentInterestRate / 100 / 12);
        const principal = Math.min(Math.max(0, monthlyPayment - interest), balance);
        balance -= principal;
        loanPayment = interest + principal;
        totalInterest += interest;
        totalPrincipalAndInterest += loanPayment;
      } else {
        balance = 0;
      }
      monthsElapsed++;

      const maintenance = propertyValue * (propertyInputs.maintenanceRate / 100 / 12);
      cumulativeMaintenance += maintenance;
      const ownerCost = loanPayment + maintenance + annualRates / 12 + annualOwnerInsurance / 12;

      const renterMoving = month === 12 ? movingCost : 0;
      const renterCost = monthlyRent + annualRenterInsurance / 12 + renterMoving;

      // Grow existing holdings, then invest whatever the cheaper option saved this month.
      renter.grow(stockReturn, dividendYield, frankingLevel, reinvestDividends);
      buyer.grow(stockReturn, dividendYield, frankingLevel, reinvestDividends);
      if (ownerCost > renterCost) {
        renter.contribute(ownerCost - renterCost);
      } else {
        buyer.contribute(renterCost - ownerCost);
      }

      propertyValue *= 1 + monthlyPropertyGrowth;
      cumulativeRent += monthlyRent;
      mortgageAnnualCost += ownerCost;
      rentAnnualCost += renterCost;
    }

    cumulativeRates += annualRates;
    cumulativeOwnerInsurance += annualOwnerInsurance;
    cumulativeRenterInsurance += annualRenterInsurance;
    cumulativeMovingCosts += movingCost;
    monthlyRent *= 1 + rentIncrease;

    snapshot(year, mortgageAnnualCost, rentAnnualCost);
  }

  return results;
}

/** Rent-minus-buy advantage after all exit costs and taxes (positive favours renting). */
export function finalAdvantage(snapshots: YearlySnapshot[]): number {
  const final = snapshots[snapshots.length - 1];
  return final.rentNetPositionAfterTax - final.mortgageNetPositionAfterSale;
}

/**
 * First year from which buying stays ahead of renting through to the end of the
 * horizon (after exit costs and taxes), or null if it never does.
 */
export function findBuyCrossoverYear(snapshots: YearlySnapshot[]): number | null {
  let crossover: number | null = null;
  for (const s of snapshots) {
    if (s.year === 0) continue;
    if (s.mortgageNetPositionAfterSale >= s.rentNetPositionAfterTax) {
      crossover ??= s.year;
    } else {
      crossover = null;
    }
  }
  return crossover;
}

const MONETARY_KEYS = [
  'mortgageEquity', 'mortgageTotalPaid', 'mortgagePropertyValue', 'mortgageLoanBalance',
  'mortgageInvestmentValue', 'mortgageNetPosition', 'mortgageNetPositionAfterSale',
  'mortgageMaintenance', 'mortgageRates', 'mortgageInsurance', 'mortgageTotalInterest',
  'mortgageAnnualCost', 'mortgageContributions', 'mortgageSaleCosts', 'rentTotalPaid', 'rentMovingCosts', 'rentInsurance',
  'rentInvestmentValue', 'rentNetPosition', 'rentNetPositionAfterTax', 'rentDividends',
  'rentFrankingCredits', 'rentAnnualCost', 'rentContributions',
] as const satisfies readonly (keyof YearlySnapshot)[];

/** Deflate every dollar figure to today's dollars. */
export function toRealTerms(snapshots: YearlySnapshot[], inflationRate: number): YearlySnapshot[] {
  return snapshots.map((s) => {
    const factor = Math.pow(1 + inflationRate / 100, s.year);
    const real = { ...s };
    for (const key of MONETARY_KEYS) real[key] = s[key] / factor;
    return real;
  });
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

export type MetricKey =
  | 'interestRate'
  | 'maintenanceRate'
  | 'monthlyRent'
  | 'rentIncreaseRate'
  | 'stockMarketReturn'
  | 'propertyGrowthRate'
  | 'dividendYield';

/** Return copies of the inputs with a single metric overridden. */
/** Cash spent on buying beyond the deposit: stamp duty and other costs, less any first home owner grant. */
export function upfrontCostsOf(p: PropertyInputs): number {
  return p.stampDuty + p.otherPurchaseCosts - (p.firstHomeGrant ?? 0);
}

export function withMetric(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  metricKey: string,
  value: number
): [PropertyInputs, RentInputs, InvestmentInputs] {
  switch (metricKey as MetricKey) {
    case 'interestRate':
    case 'maintenanceRate':
      return [{ ...propertyInputs, [metricKey]: value }, rentInputs, investmentInputs];
    case 'monthlyRent':
    case 'rentIncreaseRate':
      return [propertyInputs, { ...rentInputs, [metricKey]: value }, investmentInputs];
    case 'stockMarketReturn':
    case 'propertyGrowthRate':
    case 'dividendYield':
      return [propertyInputs, rentInputs, { ...investmentInputs, [metricKey]: value }];
    default:
      return [propertyInputs, rentInputs, investmentInputs];
  }
}

/** Baseline value of a metric (scenario inputs resolve to their baseline). */
export function getMetricValue(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  metricKey: string
): number {
  switch (metricKey as MetricKey) {
    case 'interestRate':
      return resolveScenarioValue(propertyInputs.interestRate, 'baseline');
    case 'maintenanceRate':
      return propertyInputs.maintenanceRate;
    case 'monthlyRent':
      return rentInputs.monthlyRent;
    case 'rentIncreaseRate':
      return resolveScenarioValue(rentInputs.rentIncreaseRate, 'baseline');
    case 'stockMarketReturn':
      return resolveScenarioValue(investmentInputs.stockMarketReturn, 'baseline');
    case 'propertyGrowthRate':
      return resolveScenarioValue(investmentInputs.propertyGrowthRate, 'baseline');
    case 'dividendYield':
      return investmentInputs.dividendYield ?? 0;
    default:
      return 0;
  }
}

/** One simulation per focus value, each with only that metric changed. */
export function runFocusComparison(
  propertyInputs: PropertyInputs,
  rentInputs: RentInputs,
  investmentInputs: InvestmentInputs,
  years: number,
  metricKey: string,
  values: number[]
): YearlySnapshot[][] {
  return values.map((value) =>
    runComparison(...withMetric(propertyInputs, rentInputs, investmentInputs, metricKey, value), years)
  );
}
