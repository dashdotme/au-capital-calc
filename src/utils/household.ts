// Household cash-flow simulation for the AI Squeeze view.
//
// Unlike the app's engine, which assumes both households can always spend the same
// budget, each household here has an income and living costs:
//   surplus = take-home income − living costs − housing costs
// A surplus is invested; a shortfall is covered from the offset, then shares. A buyer who
// can't cover three months of shortfalls is forced to sell and rents from then on. A forced
// sale never captures recent growth: the price is the lower of today's value and the value
// two years earlier, less a fire-sale discount. A renter who runs dry downsizes to a 20% cheaper rental, then
// borrows at a personal-loan rate. Mechanics otherwise mirror runComparison.
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { Portfolio, calculateMortgagePayment, newHomeGrowthDrag, upfrontCostsOf, type RatePaths } from '../utils/calculations';

export interface Household {
  /** Gross household income in year 1 */
  grossIncome: number;
  /** Share of gross income kept after tax (flat approximation) */
  takeHome: number;
  /** Non-housing living costs per month in year 1, rising with inflation */
  livingCosts: number;
}

export interface IncomeSpell {
  /** Month (1-based) the spell starts */
  startMonth: number;
  months: number;
  /** Share of normal household income received during the spell (e.g. 0.5 when one of two earners is out) */
  incomeShare: number;
  /** One-off reskilling cost paid at the start */
  reskillCost: number;
  /** Permanent fall in household income afterwards (0.075 = 7.5%) */
  scarring: number;
}

export interface IncomePath {
  /** Nominal household income growth for each year (index 0 = year 1), % */
  growth: number[];
  spells: IncomeSpell[];
}

export interface HouseholdResult {
  /** Rent-minus-buy net worth gap at each year (index = year) */
  gap: number[];
  buyerNetWorth: number[];
  renterNetWorth: number[];
  forcedSaleMonth: number | null;
  renterDownsizedMonth: number | null;
  /** Lowest liquid buffer (offset + shares − debts) the buyer reached while owning, from year 2 */
  buyerMinBuffer: number;
}

const FIRE_SALE_DISCOUNT = 0.05;
const ARREARS_LIMIT = 3;
const PERSONAL_LOAN_RATE = 0.1;
const DOWNSIZE = 0.8;

export function simulateHousehold(
  property: PropertyInputs,
  rent: RentInputs,
  investment: InvestmentInputs,
  years: number,
  paths: Required<RatePaths>,
  household: Household,
  income: IncomePath
): HouseholdResult {
  const tax = investment.marginalTaxRate / 100;
  const feeRate = investment.stockTransactionCost / 100;
  const inflation = investment.inflationRate / 100;
  const dividendYield = (investment.dividendYield ?? 0) / 100;
  const franking = (investment.frankingLevel ?? 0) / 100;
  const reinvest = investment.dividendReinvestment ?? true;
  const fee = (investment.managementFee ?? 0) / 100;
  const totalMonths = Math.round(property.loanTerm * 12);

  const upfront = upfrontCostsOf(property);
  const startingCapital = property.deposit + upfront + (property.offsetAccountBalance ?? 0);

  // Buyer
  const buyerShares = new Portfolio(feeRate, tax);
  let offset = property.offsetAccountBalance ?? 0;
  let balance = Math.max(0, property.propertyPrice - property.deposit + (property.lmi ?? 0));
  let currentRate = Number.NaN;
  let payment = 0;
  let value = property.propertyPrice;
  /** Home value at the end of each month, for distressed-sale pricing */
  const valueHistory: number[] = [value];
  let owns = true;
  let arrears = 0;
  let forcedSaleMonth: number | null = null;
  let buyerRentFactor = 1;
  let buyerDebt = 0;
  let buyerMinBuffer = Infinity;

  // Renter
  const renterShares = new Portfolio(feeRate, tax);
  renterShares.contribute(startingCapital);
  let renterRentFactor = 1;
  let renterDebt = 0;
  let renterDownsizedMonth: number | null = null;

  let monthlyRent = rent.monthlyRent;
  let incomeIndex = 1;
  let scarring = 1;
  let month = 0;

  const buyerNetWorth: number[] = [];
  const renterNetWorth: number[] = [];
  const record = () => {
    const sale = value * (property.sellingCostRate / 100);
    const home = owns ? value - sale - balance + offset : 0;
    buyerNetWorth.push(home + buyerShares.liquidationValue() - buyerDebt);
    renterNetWorth.push(renterShares.liquidationValue() - renterDebt);
  };
  record();

  /** Cover a shortfall from liquid assets; returns what couldn't be covered. */
  const cover = (shortfall: number, portfolio: Portfolio, useOffset: boolean) => {
    let remaining = shortfall;
    if (useOffset && offset > 0) {
      const fromOffset = Math.min(offset, remaining);
      offset -= fromOffset;
      remaining -= fromOffset;
    }
    remaining -= portfolio.withdraw(remaining);
    return remaining;
  };

  for (let year = 1; year <= years; year++) {
    const rate = paths.interestRate[year - 1];
    const stockReturn = paths.stockMarketReturn[year - 1] / 100 - fee;
    const propertyGrowth = Math.pow(1 + (paths.propertyGrowthRate[year - 1] - newHomeGrowthDrag(property, year)) / 100, 1 / 12) - 1;
    if (owns && rate !== currentRate) {
      currentRate = rate;
      payment = calculateMortgagePayment(balance, rate, (totalMonths - month) / 12);
    }
    const priceIndex = Math.pow(1 + inflation, year - 1);
    const rates = property.councilRates * priceIndex;
    const ownerInsurance = (property.buildingInsurance + property.contentsInsurance) * priceIndex;
    const renterInsurance = rent.contentsInsurance * priceIndex;
    const moves = rent.movingFrequency > 0 && year % rent.movingFrequency === 0;
    const movingCost = rent.movingCost * priceIndex;
    const living = household.livingCosts * priceIndex;

    for (let m = 1; m <= 12; m++) {
      month++;
      // Income this month, after any spell and permanent scarring
      let incomeShare = 1;
      for (const spell of income.spells) {
        if (month === spell.startMonth) {
          // Reskilling is paid by both households alike
          buyerDebt += cover(spell.reskillCost, buyerShares, owns);
          renterDebt += cover(spell.reskillCost, renterShares, false);
        }
        if (month >= spell.startMonth && month < spell.startMonth + spell.months) incomeShare *= spell.incomeShare;
        if (month === spell.startMonth + spell.months) scarring *= 1 - spell.scarring;
      }
      const takeHome = (household.grossIncome * incomeIndex * scarring * incomeShare * household.takeHome) / 12;

      // Debts accrue interest
      buyerDebt *= 1 + PERSONAL_LOAN_RATE / 12;
      renterDebt *= 1 + PERSONAL_LOAN_RATE / 12;

      // Investments grow first, as in the engine
      buyerShares.grow(stockReturn, dividendYield, franking, reinvest);
      renterShares.grow(stockReturn, dividendYield, franking, reinvest);

      // Buyer's housing cost
      let buyerHousing: number;
      if (owns) {
        let loanPayment = 0;
        if (balance > 0.005) {
          const interest = Math.max(0, balance - offset) * (currentRate / 100 / 12);
          const principal = Math.min(Math.max(0, payment - interest), balance);
          balance -= principal;
          loanPayment = interest + principal;
        } else {
          balance = 0;
        }
        buyerHousing = loanPayment + value * (property.maintenanceRate / 100 / 12) + rates / 12 + ownerInsurance / 12;
      } else {
        buyerHousing = monthlyRent * buyerRentFactor + renterInsurance / 12 + (moves && m === 12 ? movingCost : 0);
      }
      const renterHousing = monthlyRent * renterRentFactor + renterInsurance / 12 + (moves && m === 12 ? movingCost : 0);

      // Buyer cash flow
      const buyerSurplus = takeHome - living - buyerHousing;
      if (buyerSurplus >= 0) {
        const repay = Math.min(buyerDebt, buyerSurplus);
        buyerDebt -= repay;
        buyerShares.contribute(buyerSurplus - repay);
        arrears = 0;
      } else {
        const uncovered = cover(-buyerSurplus, buyerShares, owns);
        if (uncovered > 0.5) {
          if (owns) {
            arrears++;
            buyerDebt += uncovered; // missed payments become debt until resolved
            if (arrears >= ARREARS_LIMIT) {
              // Forced sale: sell at a discount, clear the loan, rent from now on
              const twoYearsAgo = valueHistory[Math.max(0, month - 24)];
              const salePrice = Math.min(value, twoYearsAgo) * (1 - FIRE_SALE_DISCOUNT);
              const proceeds = salePrice * (1 - property.sellingCostRate / 100) - balance + offset;
              owns = false;
              forcedSaleMonth = month;
              balance = 0;
              offset = 0;
              const clearDebt = Math.min(buyerDebt, Math.max(0, proceeds));
              buyerDebt -= clearDebt;
              buyerShares.contribute(Math.max(0, proceeds) - clearDebt);
              if (proceeds < 0) buyerDebt -= proceeds;
              buyerDebt += movingCost;
            }
          } else {
            if (buyerRentFactor === 1) buyerRentFactor = DOWNSIZE;
            buyerDebt += uncovered;
          }
        }
      }
      // Offset cash beyond the loan balance saves no interest, so the buyer invests it
      if (owns && offset > balance) {
        buyerShares.contribute(offset - balance);
        offset = balance;
      }
      // Track from year 2 so the opening balance doesn't mask later drawdowns
      if (owns && month > 12) buyerMinBuffer = Math.min(buyerMinBuffer, offset + buyerShares.liquidationValue() - buyerDebt);

      // Renter cash flow
      const renterSurplus = takeHome - living - renterHousing;
      if (renterSurplus >= 0) {
        const repay = Math.min(renterDebt, renterSurplus);
        renterDebt -= repay;
        renterShares.contribute(renterSurplus - repay);
      } else {
        const uncovered = cover(-renterSurplus, renterShares, false);
        if (uncovered > 0.5) {
          if (renterRentFactor === 1) {
            renterRentFactor = DOWNSIZE;
            renterDownsizedMonth = month;
          }
          renterDebt += uncovered;
        }
      }

      value *= 1 + propertyGrowth;
      valueHistory.push(value);
    }

    monthlyRent *= 1 + paths.rentIncreaseRate[year - 1] / 100;
    incomeIndex *= 1 + (income.growth[year - 1] ?? 0) / 100;
    record();
  }

  return {
    gap: renterNetWorth.map((r, i) => r - buyerNetWorth[i]),
    buyerNetWorth,
    renterNetWorth,
    forcedSaleMonth,
    renterDownsizedMonth,
    buyerMinBuffer,
  };
}
