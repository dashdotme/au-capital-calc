import type { PropertyInputs } from '../types';
import { calculateMortgagePayment, resolveScenarioValue, upfrontCostsOf } from '../utils/calculations';
import { formatCurrency, formatPercent } from '../utils/format';
import { AdornedInput } from './InputField';

interface AffordabilityProps {
  property: PropertyInputs;
  income: number | null;
  onIncomeChange: (income: number | null) => void;
}

/** Lenders assess repayments at the loan rate plus APRA's 3-point serviceability buffer. */
const SERVICEABILITY_BUFFER = 3;
/** Repayments above ~30% of gross income are a common rule of thumb for mortgage stress. */
const STRESS_SHARE = 0.3;
/** APRA limits how much new lending can go to borrowers at 6× income or more. */
const DTI_LIMIT = 6;

function Gauge({ label, value, display, limit, max, limitLabel, note }: {
  label: string;
  value: number;
  display: string;
  limit?: number;
  max: number;
  limitLabel?: string;
  note: string;
}) {
  const over = limit !== undefined && value > limit;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-2">{label}</span>
        <span className="font-mono text-lg">{display}</span>
      </div>
      <div className="relative h-2 rounded-full bg-line" aria-hidden>
        <div className="h-2 rounded-full bg-ink-2" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
        {limit !== undefined && <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${(limit / max) * 100}%` }} />}
      </div>
      <span className="text-xs text-muted">
        {limit !== undefined && (
          <span className={over ? 'font-semibold text-ink' : ''}>{over ? `Above ${limitLabel}.` : `Within ${limitLabel}.`} </span>
        )}
        {note}
      </span>
    </div>
  );
}

export default function Affordability({ property, income, onIncomeChange }: AffordabilityProps) {
  const loan = Math.max(0, property.propertyPrice - property.deposit + (property.lmi ?? 0));
  const rate = resolveScenarioValue(property.interestRate, 'baseline');
  const repayment = calculateMortgagePayment(loan, rate, property.loanTerm);
  const testRepayment = calculateMortgagePayment(loan, rate + SERVICEABILITY_BUFFER, property.loanTerm);
  const cashUpfront = property.deposit + upfrontCostsOf(property);
  const hasIncome = income !== null && income > 0;

  return (
    <section aria-label="Can you afford it" className="card flex flex-col gap-5 px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold">Can you afford to buy?</h2>
          <p className="m-0 text-[13px] text-ink-2">
            Cash needed upfront: <span className="font-mono text-ink">{formatCurrency(cashUpfront)}</span> (deposit,
            stamp duty and costs{(property.firstHomeGrant ?? 0) > 0 ? ', less the grant' : ''}). Repayments {formatCurrency(repayment)}/month.
          </p>
        </div>
        <label className="flex w-full flex-col gap-1.5 sm:w-56">
          <span className="text-[13px] text-ink-2">Household income before tax</span>
          <AdornedInput
            ariaLabel="Household income before tax, per year"
            format="currency"
            value={income ?? 0}
            onChange={(v) => onIncomeChange(v > 0 ? v : null)}
          />
        </label>
      </div>

      {hasIncome ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Gauge
            label="Repayments vs income"
            value={(repayment * 12) / income}
            display={formatPercent((repayment * 12) / income)}
            limit={STRESS_SHARE}
            max={0.6}
            limitLabel="the 30% stress line"
            note={`At ${rate}% on a ${property.loanTerm}-year loan.`}
          />
          <Gauge
            label={`At the bank's test rate (${(rate + SERVICEABILITY_BUFFER).toFixed(2)}%)`}
            value={(testRepayment * 12) / income}
            display={formatPercent((testRepayment * 12) / income)}
            max={0.8}
            note={`Lenders check you could still pay ${formatCurrency(testRepayment)}/month after living costs.`}
          />
          <Gauge
            label="Loan vs income"
            value={loan / income}
            display={`${(loan / income).toFixed(1)}×`}
            limit={DTI_LIMIT}
            max={10}
            limitLabel="6×"
            note="Loans of 6× income or more are restricted under APRA's limits."
          />
        </div>
      ) : (
        <p className="m-0 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-ink-2">
          Add your household income to check repayments against the bank's serviceability test and the 6× income limit.
        </p>
      )}
      <p className="m-0 text-xs text-muted">
        Rules of thumb only. Lenders also count your living expenses, other debts and dependants.
      </p>
    </section>
  );
}
