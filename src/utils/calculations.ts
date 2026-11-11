import { MINIMUM_GAIN_TAX, monthsUntilReform } from './cgtReform';
import type { PropertyInputs, RentInputs, InvestmentInputs, YearlySnapshot, ScenarioValue, ScenarioResults } from '../types';
import { moveStampDuty } from './stampDuty';
import {
  PENSION_AGE, SUPER_ACCESS_AGE, SUPER_CONTRIBUTIONS_TAX, SUPER_EARNINGS_TAX, SUPER_TAXABLE_GAIN,
  agePension, rentAssistance, spreadGainTax,
} from './retirement';

/** Franking credits are grossed up at the 30% company tax rate */
const COMPANY_TAX_RATE = 0.3;
/** Individuals pay CGT on half the gain for assets held over 12 months */
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
 * A new home's value grows more slowly at first: it was bought at a new-build premium
 * (about 6% on average, up to 15%) and more of its price is a building that depreciates.
 * Modelled as growth 1 point a year below the input for the first 10 years, leaving the
 * home roughly 10% below an established one bought at the same price. A judgment call:
 * there is no rigorous Australian estimate.
 */
export const NEW_HOME_GROWTH_DRAG = 1;
export const NEW_HOME_DRAG_YEARS = 10;

/** Points to subtract from property growth in a given year. */
export const newHomeGrowthDrag = (p: Pick<PropertyInputs, 'newHome'>, year: number) =>
  p.newHome && year <= NEW_HOME_DRAG_YEARS ? NEW_HOME_GROWTH_DRAG : 0;

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
 * the final sale; dividends are taxed at `taxRate` with franking credits offsetting tax
 * (and refunded if they exceed it). `taxableGainShare` is the part of a capital gain that
 * is taxed under the discount: half for individuals, two-thirds for a super fund.
 *
 * With `indexed`, capital gains follow the 2027 reform once `startReform()` is called: the
 * gain so far keeps the discount (`lockedTaxable`), and later gains are taxed in full after
 * indexing the cost base to `cpi`, at no less than 30% unless `floorExempt`. Sales are
 * proportional across holdings, so one indexed cost base (in base-period dollars) is exact.
 */
export class Portfolio {
  value = 0;
  costBase = 0;
  cash = 0;
  dividends = 0;
  frankingCredits = 0;
  /** New money put in (excludes reinvested dividends), so growth = value - contributions */
  contributions = 0;
  /** Price level now (1 = the start); set by the simulation each month */
  cpi = 1;
  /** Recipients of means-tested payments don't pay the 30% minimum tax */
  floorExempt = false;
  private reformed = false;
  /** Cost base deflated to base-period dollars, for indexation (reform only) */
  private realCost = 0;
  /** Already-discounted gain from before the reform (can be negative: a loss) */
  private lockedTaxable = 0;
  private readonly feeRate: number;
  private readonly taxRate: number;
  private readonly taxableGainShare: number;
  private readonly indexed: boolean;

  constructor(feeRate: number, taxRate: number, taxableGainShare = CGT_DISCOUNT, indexed = false) {
    this.feeRate = feeRate;
    this.taxRate = taxRate;
    this.taxableGainShare = taxableGainShare;
    this.indexed = indexed;
  }

  /**
   * Add new savings. `invested` is what lands in the portfolio when it differs from what the
   * saver gave up (salary sacrifice: pre-tax dollars less contributions tax).
   */
  contribute(amount: number, invested = amount) {
    if (amount <= 0) return;
    this.contributions += amount;
    this.buy(invested);
  }

  buy(amount: number) {
    if (amount <= 0) return;
    this.value += amount * (1 - this.feeRate);
    this.costBase += amount;
    this.realCost += amount / this.cpi;
  }

  /**
   * 1 Jul 2027: the gain so far keeps the discount, and the holdings' value becomes the
   * cost base for the rest (ATO). No-op unless the portfolio is `indexed`.
   */
  startReform() {
    if (!this.indexed || this.reformed) return;
    this.reformed = true;
    this.lockedTaxable = (this.value - this.costBase) * this.taxableGainShare;
    this.costBase = this.value;
    this.realCost = this.value / this.cpi;
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
   * Taxable gain if everything were sold now: `discounted` is taxed as income, `real` (the
   * indexed gain after the reform) as income but at least 30%. A loss on one part offsets
   * the other (the discounted part counts at its pre-discount size).
   */
  private gains(): { discounted: number; real: number } {
    const proceeds = this.value * (1 - this.feeRate);
    if (!this.reformed) return { discounted: Math.max(0, proceeds - this.costBase) * this.taxableGainShare, real: 0 };
    // Indexation can wipe out a gain but not create a loss (as under the pre-1999 rules; a
    // judgment call for the 2027 ones): below the indexed cost, only a fall below the
    // unindexed cost counts
    const indexedCost = this.realCost * this.cpi;
    const real = proceeds >= indexedCost ? proceeds - indexedCost : Math.min(0, proceeds - this.costBase);
    const locked = this.lockedTaxable;
    if (locked < 0) return { discounted: 0, real: Math.max(0, real + locked / this.taxableGainShare) };
    if (real < 0) return { discounted: Math.max(0, locked + real * this.taxableGainShare), real: 0 };
    return { discounted: locked, real };
  }

  /** CGT on selling everything now; `gainTax` turns a taxable gain into tax (default: flat `taxRate`). */
  private saleTax(gainTax: (taxableGain: number) => number = (g) => g * this.taxRate): number {
    const { discounted, real } = this.gains();
    const tax = (g: number) => (g > 0 ? gainTax(g) : 0);
    const total = tax(discounted + real);
    if (real <= 0 || this.floorExempt) return total;
    return Math.max(total, tax(discounted) + MINIMUM_GAIN_TAX * real);
  }

  /**
   * Sell enough to raise `needed` in cash after brokerage and CGT (cash held first), selling
   * an even slice of every holding. Returns the amount actually raised, which is less if the
   * portfolio runs out.
   */
  withdraw(needed: number): number {
    if (needed <= 0) return 0;
    const fromCash = Math.min(Math.max(0, this.cash), needed);
    this.cash -= fromCash;
    let remaining = needed - fromCash;
    if (remaining <= 0 || this.value <= 0) return fromCash;
    const netPerDollar = 1 - this.feeRate - this.saleTax() / this.value;
    const sold = Math.min(this.value, remaining / netPerDollar);
    const kept = 1 - sold / this.value;
    this.costBase *= kept;
    this.realCost *= kept;
    this.lockedTaxable *= kept;
    this.value -= sold;
    remaining -= sold * netPerDollar;
    return needed - remaining;
  }

  /** Value if everything were sold today, after brokerage and CGT. */
  liquidationValue(gainTax?: (taxableGain: number) => number): number {
    return this.value * (1 - this.feeRate) - this.saleTax(gainTax) + this.cash;
  }
}

/**
 * Month (counted from the start, 1 = the first month) the 2027 CGT rules begin for share
 * holdings, or null under the old rules. Zero or less: already in force at the start.
 */
export function reformMonthOf(inv: Pick<InvestmentInputs, 'cgtRules' | 'monthsToReform'>): number | null {
  if (inv.cgtRules === 'old') return null;
  return inv.monthsToReform ?? monthsUntilReform(new Date());
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
  const investedShare = Math.min(100, Math.max(0, investmentInputs.investedShare ?? 100)) / 100;
  const startingOffset = Math.max(0, propertyInputs.offsetAccountBalance ?? 0);
  const totalMonths = Math.max(0, Math.round(propertyInputs.loanTerm * 12));
  const strataLevies = Math.max(0, propertyInputs.strataLevies ?? 0);
  const moveEvery = Math.max(0, Math.round(propertyInputs.ownerMoveFrequency ?? 0));
  const homeCgtRate = propertyInputs.capitalGainsTaxRate / 100;

  const surplusToOffset = investmentInputs.buyerSurplusToOffset ?? true;
  const couple = investmentInputs.couple ?? true;
  const startAge = investmentInputs.age ?? 35;
  const superShare = Math.min(100, Math.max(0, investmentInputs.superShare ?? 0)) / 100;
  const superCapRoom = Math.max(0, investmentInputs.superCapRoom ?? 0);
  const spreadSale = investmentInputs.spreadSale ?? false;
  const saleYears = investmentInputs.saleYears ?? 1;
  const saleIncome = investmentInputs.saleIncome ?? 0;

  /** Tax on the discounted gain when selling shares, in the year whose price index is `index`. */
  const shareSaleTax = (index: number) => (taxableGain: number) =>
    spreadSale
      ? spreadGainTax(taxableGain / index, saleYears, couple ? 2 : 1, saleIncome) * index
      : taxableGain * marginalTaxRate;
  /** Super is tax-free to withdraw once retired past preservation age; before that the fund's CGT applies. */
  const superAfterTax = (fund: Portfolio, age: number) =>
    age >= SUPER_ACCESS_AGE ? fund.holdingValue() : fund.liquidationValue();

  // Both households start with the same capital: the buyer spends deposit + purchase
  // costs on the property and parks savings in the offset; the renter invests all of it.
  const upfrontCosts = upfrontCostsOf(propertyInputs);
  const startingCapital = propertyInputs.deposit + upfrontCosts + startingOffset;
  const loanAmount = Math.max(0, propertyInputs.propertyPrice - propertyInputs.deposit + (propertyInputs.lmi ?? 0));

  const reformMonth = reformMonthOf(investmentInputs);
  const indexed = reformMonth !== null;
  const renter = new Portfolio(feeRate, marginalTaxRate, CGT_DISCOUNT, indexed);
  const buyer = new Portfolio(feeRate, marginalTaxRate, CGT_DISCOUNT, indexed);
  // Super funds pay no brokerage on members' contributions
  const renterSuper = new Portfolio(0, SUPER_EARNINGS_TAX, SUPER_TAXABLE_GAIN);
  const buyerSuper = new Portfolio(0, SUPER_EARNINGS_TAX, SUPER_TAXABLE_GAIN);
  renter.contribute(startingCapital);
  // Judgment call: super funds keep their one-third discount (the reform targets individuals'
  // investments; the explainer doesn't change the super fund rules), so they're never indexed
  const shareHoldings = [renter, buyer];
  const setShareCpi = (months: number) => {
    for (const p of shareHoldings) p.cpi = Math.pow(1 + inflation, months / 12);
  };
  if (reformMonth !== null && reformMonth <= 0) shareHoldings.forEach((p) => p.startReform());

  let balance = loanAmount;
  let offset = startingOffset;
  let currentInterestRate = Number.NaN;
  let monthlyPayment = 0;
  let monthsElapsed = 0;
  let propertyValue = propertyInputs.propertyPrice;
  /** Purchase price plus costs of the home currently owned (reset when the owner moves) */
  let homeCostBase = propertyInputs.propertyPrice + upfrontCosts;
  let monthlyRent = rentInputs.monthlyRent;
  let priceIndex = 1;

  let totalPrincipalAndInterest = 0;
  let totalInterest = 0;
  let cumulativeMaintenance = 0;
  let cumulativeRates = 0;
  let cumulativeOwnerInsurance = 0;
  let cumulativeRent = 0;
  let cumulativeMovingCosts = 0;
  let cumulativeRenterInsurance = 0;
  let renterSpent = 0;
  let buyerSpent = 0;
  let cumulativeStrata = 0;
  let cumulativeOwnerMoves = 0;
  let buyerPension = 0;
  let renterPension = 0;
  /** Pension received this year: recipients of means-tested payments skip the 30% minimum tax */
  let buyerPensionYear = 0;
  let renterPensionYear = 0;

  const results: YearlySnapshot[] = [];

  const snapshot = (year: number, mortgageAnnualCost: number, rentAnnualCost: number) => {
    const sellingCosts = propertyValue * (propertyInputs.sellingCostRate / 100);
    const propertyGain = propertyValue - (homeCostBase + sellingCosts);
    const propertyCGT = propertyGain > 0 ? propertyGain * CGT_DISCOUNT * homeCgtRate : 0;
    const equity = propertyValue - balance;
    const age = startAge + year;
    // Liquidation uses this year-end's price level (snapshot 0 is today)
    const saleTax = shareSaleTax(year === 0 ? 1 : priceIndex * (1 + inflation));
    setShareCpi(monthsElapsed);
    buyer.floorExempt = buyerPensionYear > 0;
    renter.floorExempt = renterPensionYear > 0;
    const buyerHoldings = buyer.holdingValue() + buyerSuper.holdingValue();
    const buyerAfterTax = buyer.liquidationValue(saleTax) + superAfterTax(buyerSuper, age);
    const renterHoldings = renter.holdingValue() + renterSuper.holdingValue();
    const renterAfterTax = renter.liquidationValue(saleTax) + superAfterTax(renterSuper, age);

    results.push({
      year,
      mortgageEquity: equity,
      mortgageTotalPaid: upfrontCosts + totalPrincipalAndInterest,
      mortgagePropertyValue: propertyValue,
      mortgageLoanBalance: balance,
      mortgageInvestmentValue: buyer.holdingValue(),
      mortgageNetPosition: equity + offset + buyerHoldings,
      mortgageNetPositionAfterSale: equity - sellingCosts - propertyCGT + offset + buyerAfterTax,
      mortgageMaintenance: cumulativeMaintenance,
      mortgageRates: cumulativeRates,
      mortgageInsurance: cumulativeOwnerInsurance,
      mortgageTotalInterest: totalInterest,
      mortgageAnnualCost,
      mortgageContributions: buyer.contributions + buyerSuper.contributions,
      mortgageSaleCosts: sellingCosts + propertyCGT,
      mortgageStrata: cumulativeStrata,
      mortgageMoveCosts: cumulativeOwnerMoves,
      mortgageSuperValue: buyerSuper.holdingValue(),
      mortgagePension: buyerPension,
      mortgageSpent: buyerSpent,
      rentTotalPaid: cumulativeRent,
      rentMovingCosts: cumulativeMovingCosts,
      rentInsurance: cumulativeRenterInsurance,
      rentInvestmentValue: renter.holdingValue(),
      rentSuperValue: renterSuper.holdingValue(),
      rentPension: renterPension,
      rentNetPosition: renterHoldings,
      rentNetPositionAfterTax: renterAfterTax,
      rentDividends: renter.dividends,
      rentFrankingCredits: renter.frankingCredits,
      rentAnnualCost,
      rentContributions: renter.contributions + renterSuper.contributions,
      rentSpent: renterSpent,
    });
  };

  snapshot(0, 0, 0);

  for (let year = 1; year <= years; year++) {
    const interestRate = rateFor(paths.interestRate, year, baseInterestRate);
    const stockReturn = rateFor(paths.stockMarketReturn, year, baseStockReturn) / 100 - managementFee;
    const propertyGrowth = (rateFor(paths.propertyGrowthRate, year, basePropertyGrowth) - newHomeGrowthDrag(propertyInputs, year)) / 100;
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

    priceIndex = Math.pow(1 + inflation, year - 1);
    const ageThisYear = startAge + year - 1;
    const working = ageThisYear < PENSION_AGE;
    const pensionAge = ageThisYear >= PENSION_AGE;
    const annualRates = propertyInputs.councilRates * priceIndex;
    const annualStrata = strataLevies * priceIndex;
    const annualOwnerInsurance =
      (propertyInputs.buildingInsurance + propertyInputs.contentsInsurance) * priceIndex;
    const annualRenterInsurance = rentInputs.contentsInsurance * priceIndex;
    const movesThisYear = rentInputs.movingFrequency > 0 && year % rentInputs.movingFrequency === 0;
    const movingCost = movesThisYear ? rentInputs.movingCost * priceIndex : 0;
    const monthlyPropertyGrowth = Math.pow(1 + propertyGrowth, 1 / 12) - 1;

    let mortgageAnnualCost = 0;
    let rentAnnualCost = 0;
    buyerPensionYear = 0;
    renterPensionYear = 0;

    // Owner moves at the start of the year: sell, then buy a home of the same value at full
    // (not first-home) stamp duty. The loan carries over unchanged.
    let ownerMoveCost = 0;
    if (moveEvery > 0 && year > 1 && (year - 1) % moveEvery === 0) {
      const selling = propertyValue * (propertyInputs.sellingCostRate / 100);
      const duty = moveStampDuty(propertyInputs.state, propertyValue, year - 1, priceIndex);
      const otherCosts = propertyInputs.otherPurchaseCosts * priceIndex;
      const removalists = rentInputs.movingCost * priceIndex;
      const gain = propertyValue - selling - homeCostBase;
      const cgt = gain > 0 ? gain * CGT_DISCOUNT * homeCgtRate : 0;
      ownerMoveCost = selling + duty + otherCosts + removalists + cgt;
      cumulativeOwnerMoves += ownerMoveCost;
      homeCostBase = propertyValue + duty + otherCosts;
    }

    // Salary-sacrifice room under the concessional caps, pre-tax, reset each financial year
    const superRoom = { buyer: superCapRoom * priceIndex, renter: superCapRoom * priceIndex };

    /**
     * Invest a saving (after-tax dollars). By default the buyer fills the offset first while
     * it is smaller than the loan: it earns the mortgage rate, risk-free and untaxed. Then
     * `superShare` of it is salary-sacrificed into super while working: each after-tax
     * dollar forgone is 1 / (1 − marginal rate) pre-tax, less 15% contributions tax, up to
     * the cap room. The rest buys shares.
     */
    const invest = (side: 'buyer' | 'renter', amount: number) => {
      let rest = amount;
      if (side === 'buyer' && surplusToOffset && balance > offset) {
        const toOffset = Math.min(rest, balance - offset);
        offset += toOffset;
        rest -= toOffset;
      }
      if (working && superShare > 0 && rest > 0 && marginalTaxRate < 1) {
        const preTax = Math.min((rest * superShare) / (1 - marginalTaxRate), superRoom[side]);
        superRoom[side] -= preTax;
        const forgone = preTax * (1 - marginalTaxRate);
        (side === 'buyer' ? buyerSuper : renterSuper).contribute(forgone, preTax * (1 - SUPER_CONTRIBUTIONS_TAX));
        rest -= forgone;
      }
      (side === 'buyer' ? buyer : renter).contribute(rest);
    };

    for (let month = 1; month <= 12; month++) {
      // Price level for indexing share cost bases; the 2027 rules start once `reformMonth`
      // months have passed
      setShareCpi(monthsElapsed);
      if (monthsElapsed === reformMonth) shareHoldings.forEach((p) => p.startReform());
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
      cumulativeStrata += annualStrata / 12;
      const ownerMoving = month === 1 ? ownerMoveCost : 0;
      const ownerCost = loanPayment + maintenance + annualRates / 12 + annualStrata / 12 + annualOwnerInsurance / 12 + ownerMoving;

      const renterMoving = month === 12 ? movingCost : 0;
      const renterCost = monthlyRent + annualRenterInsurance / 12 + renterMoving;

      // Grow existing holdings
      renter.grow(stockReturn, dividendYield, frankingLevel, reinvestDividends);
      buyer.grow(stockReturn, dividendYield, frankingLevel, reinvestDividends);
      renterSuper.grow(stockReturn, dividendYield, frankingLevel, reinvestDividends);
      buyerSuper.grow(stockReturn, dividendYield, frankingLevel, reinvestDividends);

      // From pension age, each household gets whatever age pension the means tests allow.
      // The home is exempt from the assets test; renters also get rent assistance.
      let buyerIncome = 0;
      let renterIncome = 0;
      if (pensionAge) {
        const buyerAssets = buyer.holdingValue() + offset + buyerSuper.holdingValue();
        const renterAssets = renter.holdingValue() + renterSuper.holdingValue();
        buyerIncome = agePension({ assets: buyerAssets, homeowner: true, couple, index: priceIndex }) / 12;
        renterIncome = agePension({
          assets: renterAssets, homeowner: false, couple, index: priceIndex,
          rentAssistance: rentAssistance(monthlyRent, couple, priceIndex),
        }) / 12;
        buyerPension += buyerIncome;
        renterPension += renterIncome;
        buyerPensionYear += buyerIncome;
        renterPensionYear += renterIncome;
      }

      // Both spend the same: whoever comes out ahead this month (lower housing costs, more
      // pension) invests the difference, or the share of it that actually gets invested.
      const buyerAhead = renterCost - ownerCost + buyerIncome - renterIncome;
      if (buyerAhead < 0) {
        invest('renter', -buyerAhead * investedShare);
        renterSpent += -buyerAhead * (1 - investedShare);
      } else {
        invest('buyer', buyerAhead * investedShare);
        buyerSpent += buyerAhead * (1 - investedShare);
      }
      // Offset cash beyond the loan balance saves no interest, so the buyer invests it
      if (offset > balance) {
        buyer.contribute(offset - balance);
        offset = balance;
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
  'mortgageAnnualCost', 'mortgageContributions', 'mortgageSaleCosts', 'mortgageSpent',
  'mortgageStrata', 'mortgageMoveCosts', 'mortgageSuperValue', 'mortgagePension',
  'rentTotalPaid', 'rentMovingCosts', 'rentInsurance',
  'rentInvestmentValue', 'rentSuperValue', 'rentPension', 'rentNetPosition', 'rentNetPositionAfterTax', 'rentDividends',
  'rentFrankingCredits', 'rentAnnualCost', 'rentContributions', 'rentSpent',
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
  | 'dividendYield'
  | 'investedShare';

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
    case 'investedShare':
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
    case 'investedShare':
      return investmentInputs.investedShare ?? 100;
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
