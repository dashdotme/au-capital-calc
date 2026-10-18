import { useEffect, useRef, useState } from 'react';
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { CITIES, applyCity } from '../cities';
import { PORTFOLIOS, applyPortfolio } from '../portfolios';
import { calculateMortgagePayment, resolveScenarioValue, runComparison } from '../utils/calculations';
import { formatCurrency } from '../utils/format';
import { withStampDuty } from '../utils/stampDuty';
import { AdornedInput } from './InputField';

interface GuidedFlowProps {
  property: PropertyInputs;
  rent: RentInputs;
  investment: InvestmentInputs;
  horizon: number;
  onApply: (next: { property: PropertyInputs; rent: RentInputs; investment: InvestmentInputs; sellYear: number }) => void;
  onClose: () => void;
}

const STEPS = ['Where', 'The home', 'Renting instead', 'Your plans'];
const STAY_OPTIONS = [5, 10, 20, 30];

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-4 text-left text-[15px] ${
        selected ? 'border-ink bg-raised font-semibold' : 'border-line-strong bg-surface hover:border-ink-2'
      }`}
    >
      {children}
    </button>
  );
}

/** A short first-visit questionnaire that fills in the main inputs. */
export default function GuidedFlow({ property, rent, investment, horizon, onApply, onClose }: GuidedFlowProps) {
  const [step, setStep] = useState(0);
  const [p, setRawP] = useState(property);
  const setP = (next: PropertyInputs) => setRawP(withStampDuty(next));
  const [r, setR] = useState(rent);
  const [inv, setInv] = useState(investment);
  const [stay, setStay] = useState(Math.min(horizon, 30));
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loan = Math.max(0, p.propertyPrice - p.deposit + (p.lmi ?? 0));
  const repayment = calculateMortgagePayment(loan, resolveScenarioValue(p.interestRate, 'baseline'), p.loanTerm);
  const firstYear = runComparison(p, r, inv, 1)[1];
  const own = firstYear.mortgageAnnualCost / 12;
  const renting = firstYear.rentAnnualCost / 12;
  const city = CITIES.find((c) => c.id === p.location);
  const last = step === STEPS.length - 1;

  const finish = () => onApply({ property: p, rent: r, investment: inv, sellYear: stay });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ground">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
        className="mx-auto flex min-h-full max-w-[1080px] flex-col gap-8 px-4 py-6 outline-none sm:px-6 sm:py-10"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-ink-2">Step {step + 1} of {STEPS.length}</span>
          <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-line px-3 text-sm text-ink-2 hover:text-ink">
            Skip to the answer
          </button>
        </div>
        <ol aria-label="Progress" className="m-0 grid list-none grid-cols-4 gap-2 p-0">
          {STEPS.map((name, i) => (
            <li key={name} className="flex flex-col gap-2">
              <span className={`h-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />
              <span className={`hidden text-[13px] sm:block ${i === step ? 'font-semibold text-ink' : 'text-muted'}`}>{name}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-start gap-10">
          <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-7">
            {step === 0 && (
              <>
                <h1 id="guide-title" className="m-0 text-3xl leading-tight font-bold tracking-tight sm:text-[44px]">Where are you looking to buy?</h1>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CITIES.map((c) => (
                    <Choice key={c.id} selected={p.location === c.id} onClick={() => { const [np, nr] = applyCity(p, r, c); setP(np); setR(nr); }}>
                      {c.name}
                      <span className="block font-mono text-xs font-normal text-muted">{formatCurrency(c.price)}</span>
                    </Choice>
                  ))}
                </div>
                <p className="m-0 text-sm text-muted">Median home values, Sep 2026. You'll set your own price next.</p>
              </>
            )}

            {step === 1 && (
              <>
                <h1 id="guide-title" className="m-0 text-3xl leading-tight font-bold tracking-tight sm:text-[44px]">What would you pay, and put down?</h1>
                <label className="flex max-w-md flex-col gap-2">
                  <span className="text-sm text-ink-2">Purchase price</span>
                  <AdornedInput ariaLabel="Purchase price" format="currency" value={p.propertyPrice}
                    onChange={(propertyPrice) => setP({ ...p, propertyPrice, deposit: Math.round(propertyPrice * 0.2), location: undefined })} />
                  {city && <span className="text-xs text-muted">{city.name} median {formatCurrency(city.price)}</span>}
                </label>
                <label className="flex max-w-md flex-col gap-2">
                  <span className="text-sm text-ink-2">Deposit</span>
                  <AdornedInput ariaLabel="Deposit" format="currency" value={p.deposit} onChange={(deposit) => setP({ ...p, deposit })} />
                  <span className="text-xs text-muted">
                    {p.propertyPrice > 0 ? `${Math.round((p.deposit / p.propertyPrice) * 100)}% of the price` : ''}
                    {p.deposit < p.propertyPrice * 0.2 ? ' · under 20% usually means mortgage insurance' : ' · no mortgage insurance'}
                  </span>
                </label>
              </>
            )}

            {step === 2 && (
              <>
                <h1 id="guide-title" className="m-0 text-3xl leading-tight font-bold tracking-tight sm:text-[44px]">What would a similar home cost to rent?</h1>
                <label className="flex max-w-md flex-col gap-2">
                  <span className="text-sm text-ink-2">Rent per month</span>
                  <AdornedInput ariaLabel="Rent per month" format="currency" value={r.monthlyRent} onChange={(monthlyRent) => setR({ ...r, monthlyRent })} />
                  <span className="text-xs text-muted">About {formatCurrency((r.monthlyRent * 12) / 52)} a week</span>
                </label>
              </>
            )}

            {step === 3 && (
              <>
                <h1 id="guide-title" className="m-0 text-3xl leading-tight font-bold tracking-tight sm:text-[44px]">How long might you stay, and where would savings go?</h1>
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 p-0 text-sm text-ink-2">Years before you'd sell</legend>
                  <div className="flex flex-wrap gap-2">
                    {STAY_OPTIONS.filter((y) => y <= horizon).map((y) => (
                      <Choice key={y} selected={stay === y} onClick={() => setStay(y)}>{y} years</Choice>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 p-0 text-sm text-ink-2">Invest the difference in</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {PORTFOLIOS.map((x) => (
                      <Choice key={x.id} selected={inv.portfolio === x.id} onClick={() => setInv(applyPortfolio(inv, x))}>
                        {x.name}
                        <span className="block font-mono text-xs font-normal text-muted">{x.example} · {x.returns.baseline}% a year</span>
                      </Choice>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="min-h-12 rounded-xl border border-line-strong px-5 text-[15px] text-ink-2">
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => (last ? finish() : setStep(step + 1))}
                className="min-h-12 rounded-xl bg-ink px-6 text-[15px] font-semibold text-ground"
              >
                {last ? 'Show my answer' : `Next: ${STEPS[step + 1].toLowerCase()}`}
              </button>
            </div>
          </section>

          <aside aria-label="What that means" className="flex flex-[1_1_300px] flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
            <span className="eyebrow">What that means</span>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-ink-2">Cash needed upfront</span>
              <span className="font-mono text-2xl">{formatCurrency(p.deposit + p.stampDuty + p.otherPurchaseCosts)}</span>
              <span className="text-xs text-muted">Deposit, {formatCurrency(p.stampDuty)} stamp duty and costs</span>
            </div>
            <div className="h-px bg-line" />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-ink-2">Loan repayments</span>
              <span className="font-mono text-2xl">{formatCurrency(repayment)}<span className="text-sm text-muted">/month</span></span>
            </div>
            <div className="h-px bg-line" />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-ink-2">First-year cost, own vs rent</span>
              <span className="font-mono text-2xl">{formatCurrency(own)} <span className="text-sm text-muted">vs {formatCurrency(renting)}</span></span>
              <span className="text-xs text-muted">Whichever is cheaper invests the difference.</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
