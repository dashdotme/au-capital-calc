// Investment property vs a share ETF, for one investor on a salary, under the 2026–27 Budget
// negative gearing and CGT reforms (law: Treasury Laws Amendment (Tax Reform No. 1) Act 2026).
//
// Sources, read 7 Nov 2026:
// - ATO, "Tax reform – Boosting home ownership – Reforming negative gearing and capital gains
//   tax" (updated 29 Jun 2026) and the Budget 2026–27 Tax Explainer "Negative Gearing and
//   Capital Gains Tax Reform". From 1 Jul 2027:
//   - The 50% CGT discount is replaced by CPI indexation of the cost base and a 30% minimum
//     tax on the real gain, for all CGT assets (shares too). Gains accrued before 1 Jul 2027
//     keep the 50% discount; the asset's value on that date becomes the cost base for the rest.
//   - Rental losses on established homes bought from 7:30pm 12 May 2026 only offset residential
//     property income, including capital gains, carried forward if unused. They could be
//     negatively geared until 30 Jun 2027.
//   - New builds keep negative gearing, and at sale may choose the 50% discount or indexation.
//   - Recipients of means-tested payments are exempt from the minimum tax (not modelled: the
//     investor here is working when they sell).
// - Capital works (Div 43): 2.5% a year of construction cost for homes built after 15 Sep 1987,
//   and it reduces the cost base (ATO, "Rental properties – capital works").
// - Second-hand plant and equipment in residential rentals bought since 9 May 2017 can't be
//   depreciated (ATO), so only new builds get plant depreciation.
// - Holding costs while land is vacant (here, during construction: interest, council rates and
//   land tax) aren't deductible since 1 Jul 2019 (s 26-102 ITAA 1997); they go into the cost
//   base instead.
// - Land tax follows each state's schedule (landTax.ts) on the land's share of the value,
//   assessed once a year.
//
// - Lenders mortgage insurance above 80% LVR uses the app's owner-occupier estimate (investors
//   can't use the 5% Deposit Scheme) and is added to the loan; it is a borrowing cost,
//   deductible over 5 years (ATO), which is ignored here.
// - New builds grow a point slower for their first 10 years, the same judgment call as the
//   rent-or-buy model (NEW_HOME_GROWTH_DRAG in calculations.ts): a new-build premium, and more
//   of the price is a building that wears out.
//
// The comparison follows the rest of the app: both investors start with the same cash and
// spend the same each month. When the property costs money after tax, the shares investor
// invests the same amount; when it throws off cash, the property investor invests it in the
// same ETF. Tax brackets rise with inflation, as elsewhere in the app.

import { incomeTax } from './retirement';
import { investorStampDuty, type AuState } from './stampDuty';
import { estimateLmi } from './homeBuyerSupport';
import { landTax } from './landTax';
import { NEW_HOME_DRAG_YEARS, NEW_HOME_GROWTH_DRAG } from './calculations';
import { MINIMUM_GAIN_TAX, monthsUntilReform, type TaxRules } from './cgtReform';

export { monthsUntilReform, type TaxRules };
export type IpKind = 'new' | 'established';

export interface IpInputs {
  kind: IpKind;
  state: AuState;
  price: number;
  /** % of the price that is land. New builds pay duty on the land only (separate build contract). */
  landShare: number;
  /** New builds: months until the home can be rented; interest in that time isn't deductible */
  buildMonths: number;
  /** Loan as % of the price */
  lvr: number;
  interestRate: number;
  /**
   * Years of interest-only repayments from purchase, after which the loan reverts to principal
   * and interest over the rest of its 30-year term; 0 means principal and interest throughout.
   */
  ioYears: number;
  /** % a year */
  growth: number;
  /** Gross rent as % of the value when it is first rented */
  grossYield: number;
  /** % a year */
  rentGrowth: number;
  /** Property management, % of rent collected (incl. GST) */
  management: number;
  /** % of the year empty */
  vacancy: number;
  /** $ a year, today's dollars */
  insurance: number;
  councilRates: number;
  strata: number;
  /** % of the building value a year */
  maintenance: number;
  /** Established homes: construction cost eligible for 2.5% capital works deductions (0 if built before Sep 1987) */
  capitalWorksBase: number;
  /** New builds: depreciable fittings (plant), written off at diminishing value */
  plant: number;
  /** Conveyancing, inspections, loan fees */
  purchaseCosts: number;
  /** % of the sale price */
  sellingCosts: number;
  /** Total return before fees, % a year */
  etfReturn: number;
  etfFee: number;
  etfYield: number;
  /** % of distributions franked */
  franking: number;
  salary: number;
  salaryGrowth: number;
  inflation: number;
  years: number;
  rules: TaxRules;
  /** Months from purchase until 1 Jul 2027 (0 or less: bought after it) */
  monthsToReform: number;
}

export interface IpYear {
  year: number;
  propertyValue: number;
  loanBalance: number;
  /** Rent collected this year */
  rent: number;
  /** Rent less expenses and interest (and principal), before tax */
  cashFlow: number;
  /** Rental income or loss for tax, after depreciation */
  taxableRental: number;
  /** Extra tax the property investor paid this year compared with the shares investor (negative: less) */
  taxDifference: number;
  /** Quarantined rental losses waiting to be used */
  carriedLoss: number;
  sharesValue: number;
  sideSharesValue: number;
  /** Net worth if everything is sold at the end of this year, after selling costs and tax */
  propertyNet: number;
  sharesNet: number;
  propertyCgt: number;
  sideSharesCgt: number;
  sharesCgt: number;
  /** Which CGT treatment the property sale used */
  cgtMethod: 'discount' | 'indexation' | 'split';
}

export interface IpResult {
  startingCash: number;
  stampDuty: number;
  /** Lenders mortgage insurance, added to the loan */
  lmi: number;
  loan: number;
  years: IpYear[];
}

/** 2.5% capital works rate (ATO) */
const CAPITAL_WORKS_RATE = 0.025;
/** Rough: average effective life of a new rental's fittings, for diminishing value (rate 2 ÷ life) */
const PLANT_LIFE = 8;
const COMPANY_TAX = 0.3;

/** Income tax with brackets scaled by `cpi` (today's-dollar brackets × price level). */
function taxAt(income: number, cpi: number): number {
  return incomeTax(income / cpi) * cpi;
}

/**
 * Tax on a capital gain on top of `otherIncome`: `discounted` is the already-halved part
 * (pre-Jul-2027 gains, or the new-build option), `real` the indexed gain after 1 Jul 2027,
 * which pays at least 30%. Medicare is included when testing the floor (a simplification).
 */
export function capitalGainTax(otherIncome: number, discounted: number, real: number, cpi: number): number {
  const base = taxAt(otherIncome, cpi);
  const withDiscounted = taxAt(otherIncome + discounted, cpi);
  const withAll = taxAt(otherIncome + discounted + real, cpi);
  return withDiscounted - base + Math.max(withAll - withDiscounted, MINIMUM_GAIN_TAX * real);
}

/** Uses a carried-forward property loss against a gain: the real part first (it pays the most), then the discounted part. */
function applyLoss(discounted: number, real: number, loss: number): [number, number] {
  const fromReal = Math.min(real, loss);
  return [Math.max(0, discounted - (loss - fromReal)), real - fromReal];
}

interface Parcel {
  value: number;
  cost: number;
  cpi: number;
  preReform: boolean;
}

/** ETF holdings tracked by parcel, so each buy is indexed from its own date. */
class Etf {
  parcels: Parcel[] = [];
  /** Halved gain locked in on pre-reform parcels at 1 Jul 2027 */
  lockedDiscounted = 0;

  buy(amount: number, cpi: number, preReform: boolean) {
    if (amount > 0) this.parcels.push({ value: amount, cost: amount, cpi, preReform });
  }

  get value() {
    return this.parcels.reduce((sum, p) => sum + p.value, 0);
  }

  grow(factor: number) {
    for (const p of this.parcels) p.value *= factor;
  }

  /** 1 Jul 2027: pre-reform parcels keep their discounted gain so far; their value becomes the new cost base. */
  reformReset(cpi: number) {
    for (const p of this.parcels) {
      if (!p.preReform) continue;
      this.lockedDiscounted += 0.5 * (p.value - p.cost);
      Object.assign(p, { cost: p.value, cpi, preReform: false });
    }
  }

  /** [discounted, real] gain if everything were sold now */
  gains(cpi: number, rules: TaxRules): [number, number] {
    if (rules === 'old') return [Math.max(0, 0.5 * (this.value - this.cost())), 0];
    let discounted = this.lockedDiscounted;
    let real = 0;
    for (const p of this.parcels) {
      if (p.preReform) discounted += 0.5 * (p.value - p.cost);
      else real += p.value - (p.cost * cpi) / p.cpi;
    }
    // Losses on one part offset gains on the other, before the discount (roughly)
    if (discounted < 0) return [0, Math.max(0, real + 2 * discounted)];
    if (real < 0) return [Math.max(0, discounted + real / 2), 0];
    return [discounted, real];
  }

  private cost() {
    return this.parcels.reduce((sum, p) => sum + p.cost, 0) - 2 * this.lockedDiscounted;
  }
}

export function stampDutyFor(input: Pick<IpInputs, 'kind' | 'state' | 'price' | 'landShare'>): number {
  // House-and-land: duty on the land contract only (the build contract isn't dutiable)
  const dutiable = input.kind === 'new' ? input.price * (input.landShare / 100) : input.price;
  return investorStampDuty(input.state, dutiable);
}

export function runInvestmentProperty(input: IpInputs): IpResult {
  const months = Math.round(input.years) * 12;
  const price = input.price;
  const landShare = Math.min(1, Math.max(0, input.landShare / 100));
  const building = price * (1 - landShare);
  const isNew = input.kind === 'new';
  const buildMonths = isNew ? Math.max(0, Math.round(input.buildMonths)) : 0;
  const lmi = estimateLmi({ propertyPrice: price, deposit: price * (1 - input.lvr / 100), state: input.state, firstHomeBuyer: false });
  const loan = price * (input.lvr / 100) + lmi;
  const stampDuty = stampDutyFor(input);
  const startingCash = price * (1 - input.lvr / 100) + stampDuty + input.purchaseCosts;
  const reformMonth = input.rules === 'reform' ? input.monthsToReform : -Infinity;
  const reformed = (month: number) => month >= reformMonth;

  // Negative gearing: new builds always; established homes bought after the announcement only until 1 Jul 2027
  const quarantined = (month: number) => !isNew && input.rules === 'reform' && reformed(month);

  const sharesOnly = new Etf();
  const side = new Etf();
  sharesOnly.buy(startingCash, 1, !reformed(0));

  const monthlyRate = input.interestRate / 100 / 12;
  const monthlyEtf = Math.pow(1 + (input.etfReturn - input.etfFee) / 100, 1 / 12);
  const monthlyGrowth = (month: number) =>
    Math.pow(1 + (input.growth - (isNew && month <= NEW_HOME_DRAG_YEARS * 12 ? NEW_HOME_GROWTH_DRAG : 0)) / 100, 1 / 12);
  const ioMonths = Math.max(0, Math.round(input.ioYears * 12));
  const TERM_MONTHS = 30 * 12; // the standard Australian loan term
  const monthlyCpi = Math.pow(1 + input.inflation / 100, 1 / 12);
  const etfYield = input.etfYield / 100;
  const frankingShare = input.franking / 100;
  const capitalWorksBase = isNew ? building : input.capitalWorksBase;

  let value = price;
  let cpi = 1;
  let salary = input.salary;
  let balance = loan;
  let payment = 0;
  let rent = 0;
  let plantLeft = isNew ? input.plant : 0;
  let capitalWorksClaimed = 0;
  let holdingCosts = 0;
  let yearLandTax = 0;
  let carriedLoss = 0;
  let valueAtReform: number | null = reformed(0) ? null : price;
  let cpiAtReform = 1;

  // Year accumulators
  let deductible = 0;
  let quarantinedNet = 0;
  let yearRent = 0;
  let yearCash = 0;
  const dist = { a: 0, aCredits: 0, b: 0, bCredits: 0 };
  const years: IpYear[] = [];

  for (let m = 1; m <= months; m++) {
    const complete = m > buildMonths;
    // Construction: land settles up front, the build is drawn evenly
    const drawn = complete ? balance : loan * (landShare + (1 - landShare) * (m / Math.max(1, buildMonths)));
    const interest = drawn * monthlyRate;
    let principal = 0;
    if (complete && m > ioMonths) {
      if (payment === 0) {
        // Reverts to principal and interest over what's left of the term
        const n = Math.max(12, TERM_MONTHS - Math.max(ioMonths, buildMonths));
        payment = monthlyRate > 0 ? (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n)) : balance / n;
      }
      principal = Math.min(balance, payment - interest);
      balance -= principal;
    }

    // Assessed once a year on the land's value then
    if (m % 12 === 1) yearLandTax = landTax(input.state, value * landShare, value / price, cpi);
    const councilAndLandTax = (input.councilRates * cpi + yearLandTax) / 12;
    if (complete && rent === 0) rent = (input.grossYield / 100) * value / 12;
    const collected = complete ? rent * (1 - input.vacancy / 100) : 0;
    const expenses = complete
      ? collected * (input.management / 100) +
        ((input.insurance + input.strata) * cpi) / 12 + councilAndLandTax +
        ((input.maintenance / 100) * building * cpi) / 12
      : councilAndLandTax;
    const cash = collected - expenses - interest - principal;
    yearRent += collected;
    yearCash += cash;

    if (complete) {
      const capitalWorks = (capitalWorksBase * CAPITAL_WORKS_RATE) / 12;
      const plant = (plantLeft * (2 / PLANT_LIFE)) / 12;
      plantLeft -= plant;
      capitalWorksClaimed += capitalWorks;
      const net = collected - expenses - interest - capitalWorks - plant;
      if (quarantined(m)) quarantinedNet += net;
      else deductible += net;
    } else {
      holdingCosts += interest + expenses;
    }

    // Distributions this month are taxed and reinvested at year end
    for (const [etf, key] of [[sharesOnly, 'a'], [side, 'b']] as const) {
      const d = (etf.value * etfYield) / 12;
      dist[key] += d;
      dist[`${key}Credits`] += (d * frankingShare * COMPANY_TAX) / (1 - COMPANY_TAX);
    }
    // Price growth is the total return less the distribution paid out
    sharesOnly.grow(monthlyEtf - etfYield / 12);
    side.grow(monthlyEtf - etfYield / 12);
    value *= monthlyGrowth(m);
    cpi *= monthlyCpi;

    // Equal budgets: a shortfall on the property is matched by the shares investor investing
    if (cash < 0) sharesOnly.buy(-cash, cpi, !reformed(m));
    else side.buy(cash, cpi, !reformed(m));

    if (m === reformMonth) {
      sharesOnly.reformReset(cpi);
      side.reformReset(cpi);
      valueAtReform = value;
      cpiAtReform = cpi;
    }

    if (m % 12 === 0) {
      // Quarantined losses carry forward and soak up later rental profits
      if (quarantinedNet < 0) carriedLoss -= quarantinedNet;
      else {
        const used = Math.min(carriedLoss, quarantinedNet);
        carriedLoss -= used;
        deductible += quarantinedNet - used;
      }
      const base = taxAt(salary, cpi);
      const taxA = taxAt(salary + dist.a + dist.aCredits, cpi) - dist.aCredits - base;
      const taxB = taxAt(salary + deductible + dist.b + dist.bCredits, cpi) - dist.bCredits - base;
      // Each reinvests distributions after that tax (the property investor's includes any
      // negative gearing refund). If one comes out negative they pay it from salary, and the
      // other invests the same amount.
      for (const [net, own, other] of [[dist.a - taxA, sharesOnly, side], [dist.b - taxB, side, sharesOnly]] as const) {
        (net >= 0 ? own : other).buy(Math.abs(net), cpi, !reformed(m));
      }

      // Liquidation if sold now, on top of this year's salary
      const proceeds = value * (1 - input.sellingCosts / 100);
      const costBase = price + stampDuty + input.purchaseCosts + holdingCosts - capitalWorksClaimed;
      const [sideD, sideR] = side.gains(cpi, input.rules);
      const propertyOptions: { method: IpYear['cgtMethod']; d: number; r: number }[] = [];
      const nominal = proceeds - costBase;
      if (input.rules === 'old' || !reformed(m)) {
        propertyOptions.push({ method: 'discount', d: Math.max(0, 0.5 * nominal), r: 0 });
      } else {
        if (valueAtReform !== null) {
          // Bought before 1 Jul 2027: discount on the gain to then, indexation after
          const pre = valueAtReform - costBase;
          const post = proceeds - (valueAtReform * cpi) / cpiAtReform;
          const d = pre >= 0 ? 0.5 * Math.max(0, pre + Math.min(0, post)) : 0;
          const r = pre >= 0 ? Math.max(0, post) : Math.max(0, post + pre);
          propertyOptions.push({ method: 'split', d, r });
        } else {
          propertyOptions.push({ method: 'indexation', d: 0, r: Math.max(0, proceeds - costBase * cpi) });
        }
        if (isNew) propertyOptions.push({ method: 'discount', d: Math.max(0, 0.5 * nominal), r: 0 });
      }
      const sideAlone = capitalGainTax(salary, sideD, sideR, cpi);
      const best = propertyOptions
        .map((o) => {
          const [d, r] = applyLoss(o.d, o.r, carriedLoss);
          const total = capitalGainTax(salary, d + sideD, r + sideR, cpi);
          return { ...o, total };
        })
        .reduce((a, b) => (b.total < a.total ? b : a));
      const [aD, aR] = sharesOnly.gains(cpi, input.rules);
      const sharesCgt = capitalGainTax(salary, aD, aR, cpi);

      years.push({
        year: m / 12,
        propertyValue: value,
        loanBalance: balance,
        rent: yearRent,
        cashFlow: yearCash,
        taxableRental: deductible,
        taxDifference: taxB - taxA,
        carriedLoss,
        sharesValue: sharesOnly.value,
        sideSharesValue: side.value,
        propertyNet: proceeds - balance + side.value - best.total,
        sharesNet: sharesOnly.value - sharesCgt,
        propertyCgt: best.total - sideAlone,
        sideSharesCgt: sideAlone,
        sharesCgt,
        cgtMethod: best.method,
      });

      deductible = 0;
      quarantinedNet = 0;
      yearRent = 0;
      yearCash = 0;
      dist.a = dist.aCredits = dist.b = dist.bCredits = 0;
      salary *= 1 + input.salaryGrowth / 100;
      rent *= 1 + input.rentGrowth / 100;
    }
  }

  return { startingCash, stampDuty, lmi, loan, years };
}


/** Property growth (% a year) at which the property and shares finish level, by bisection. */
export function breakEvenGrowth(input: IpInputs): number | null {
  const lead = (growth: number) => {
    const last = runInvestmentProperty({ ...input, growth }).years.at(-1);
    return last ? last.propertyNet - last.sharesNet : 0;
  };
  let lo = -2;
  let hi = 12;
  if (lead(lo) > 0 || lead(hi) < 0) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (lead(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
