import type { ReactNode } from 'react';
import type { InvestmentInputs, PropertyInputs, RentInputs, ScenarioValue } from '../types';
import type { InputFormat } from '../utils/format';
import { formatCurrency } from '../utils/format';
import { isScenarioValue } from '../utils/calculations';
import InputField, { AdornedInput } from './InputField';
import { PORTFOLIOS, applyPortfolio } from '../portfolios';
import { CITIES, applyCity } from '../cities';
import { AU_STATES, isAuState, stampDutyBasis } from '../utils/stampDuty';
import { NEW_HOME_GROWTH_NOTE, NEW_HOME_GROWTH_SHORT, grantNote, guaranteeApplies, lmiNote } from '../utils/homeBuyerSupport';
import MultiInput from './MultiInput';
import NewHomeGrowthSources from './NewHomeGrowthSources';
import { INVESTED_SHARE_NOTE } from '../utils/narrative';

interface AssumptionsPanelProps {
  propertyInputs: PropertyInputs;
  rentInputs: RentInputs;
  investmentInputs: InvestmentInputs;
  timeHorizon: number;
  onPropertyChange: (inputs: PropertyInputs) => void;
  onRentChange: (inputs: RentInputs) => void;
  onPropertyAndRentChange: (property: PropertyInputs, rent: RentInputs) => void;
  onInvestmentChange: (inputs: InvestmentInputs) => void;
  onTimeHorizonChange: (years: number) => void;
  onReset: () => void;
  scenarioMode: boolean;
  focusMetric: string | null;
  onFocusMetric: (metric: string | null) => void;
  monthlyRepayment: number;
  /** Price-to-income note shown under the property growth input */
  growthNote?: string;
}

const TAX_BRACKETS = [
  { value: 17, label: '17% · $18k to $45k' },
  { value: 32, label: '32% · $45k to $135k' },
  { value: 39, label: '39% · $135k to $190k' },
  { value: 47, label: '47% · over $190k' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-line px-5 py-5">
      <h3 className="eyebrow m-0">{title}</h3>
      {children}
    </section>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export default function AssumptionsPanel({
  propertyInputs,
  rentInputs,
  investmentInputs,
  timeHorizon,
  onPropertyChange,
  onRentChange,
  onPropertyAndRentChange,
  onInvestmentChange,
  onTimeHorizonChange,
  onReset,
  scenarioMode,
  focusMetric,
  onFocusMetric,
  monthlyRepayment,
  growthNote,
}: AssumptionsPanelProps) {
  const p = propertyInputs;
  const r = rentInputs;
  const inv = investmentInputs;

  const explore = (metric: string) => ({
    onFocusMode: () => onFocusMetric(focusMetric === metric ? null : metric),
    focusActive: focusMetric === metric,
  });

  /** Three inputs in scenario mode, one (the baseline) otherwise. */
  const scenarioField = (
    label: string,
    value: number | ScenarioValue,
    onChange: (value: number | ScenarioValue) => void,
    metric: string,
    format: InputFormat = 'percent',
    helpText?: ReactNode
  ) =>
    scenarioMode ? (
      <MultiInput
        label={label}
        value={isScenarioValue(value) ? value : { pessimistic: value, baseline: value, optimistic: value }}
        onChange={onChange}
        format={format}
        helpText={helpText}
        {...explore(metric)}
      />
    ) : (
      <InputField
        label={label}
        value={isScenarioValue(value) ? value.baseline : value}
        onChange={onChange}
        format={format}
        helpText={helpText}
        {...explore(metric)}
      />
    );

  /** Hand-editing a city-derived value means the inputs no longer match the preset. */
  const onCityProperty = (patch: Partial<PropertyInputs>) => onPropertyChange({ ...p, ...patch, location: undefined });

  /** Hand-editing a portfolio parameter means it no longer matches a preset. */
  const onPortfolioParam = (patch: Partial<InvestmentInputs>) =>
    onInvestmentChange({ ...inv, ...patch, portfolio: undefined });

  const city = CITIES.find((c) => c.id === p.location);
  const lvr = p.propertyPrice > 0 ? ((p.propertyPrice - p.deposit) / p.propertyPrice) * 100 : 0;

  return (
    <aside id="assumptions" aria-label="Assumptions" className="card flex flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="m-0 text-[15px] font-semibold">Assumptions</h2>
        <button
          type="button"
          onClick={onReset}
          className="min-h-8 rounded-md border border-line px-2.5 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
        >
          Reset
        </button>
      </div>

      <Section title="The home">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-2">Location</span>
          <select
            className="input-field"
            value={p.location ?? 'custom'}
            onChange={(e) => {
              const city = CITIES.find((c) => c.id === e.target.value);
              if (city) onPropertyAndRentChange(...applyCity(p, r, city));
            }}
          >
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.state !== 'avg' ? ` (${c.state})` : ''}</option>
            ))}
            <option value="custom" disabled={p.location !== undefined}>Custom</option>
          </select>
          <span className="text-xs leading-snug text-muted">
            Fills median price (Sep 2026), 20% deposit, state, rent, rates and insurance.
          </span>
        </label>
        <Pair>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-2">State rules</span>
            <select
              className="input-field"
              value={p.state ?? 'manual'}
              onChange={(e) => {
                const state = isAuState(e.target.value) ? e.target.value : undefined;
                onCityProperty({ state });
              }}
            >
              {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="manual">None (enter duty)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-2">Buyer</span>
            <select
              className="input-field"
              value={p.firstHomeBuyer ? 'first' : 'owned'}
              onChange={(e) => onPropertyChange({ ...p, firstHomeBuyer: e.target.value === 'first' })}
            >
              <option value="first">First home buyer</option>
              <option value="owned">Owned before</option>
            </select>
          </label>
        </Pair>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-2">Home</span>
          <select
            className="input-field"
            value={p.newHome ? 'new' : 'established'}
            onChange={(e) => onPropertyChange({ ...p, newHome: e.target.value === 'new' })}
          >
            <option value="established">Established</option>
            <option value="new">New (never lived in)</option>
          </select>
          {p.newHome && <span className="text-xs leading-snug text-muted">{NEW_HOME_GROWTH_NOTE} <NewHomeGrowthSources /></span>}
        </label>
        <InputField label="Purchase price" format="currency" value={p.propertyPrice}
          onChange={(propertyPrice) => onCityProperty({ propertyPrice })} />
        <InputField label="Deposit" format="currency" value={p.deposit}
          onChange={(deposit) => onPropertyChange({ ...p, deposit })} />
        <div className="flex flex-col gap-1.5" aria-label={`Loan to value ratio ${lvr.toFixed(1)}%`}>
          <div className="flex justify-between text-xs text-ink-2">
            <span>LVR {lvr.toFixed(1)}%</span>
            <span>{lvr <= 80 ? 'No LMI at 80% or below' : guaranteeApplies(p) ? 'LMI waived: 5% Deposit Scheme' : 'Above 80%: lenders charge LMI'}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-line" aria-hidden>
            <div className="absolute inset-y-0 left-0 rounded-full bg-ink-2" style={{ width: `${Math.min(100, Math.max(0, lvr))}%` }} />
            <div className="absolute -inset-y-1 left-[80%] w-0.5 bg-ink" />
          </div>
        </div>
        {(lvr > 80 || (p.lmi ?? 0) > 0) && (
          <InputField label="Lenders mortgage insurance" format="currency" value={p.lmi ?? 0}
            onChange={(lmi) => onPropertyChange({ ...p, lmi, lmiEstimated: false })}
            helpText={
              <>
                Added to the loan. {lmiNote(p)}
                {!p.lmiEstimated && (
                  <>
                    {' '}
                    <button type="button" className="underline hover:text-ink" onClick={() => onPropertyChange({ ...p, lmiEstimated: true })}>
                      Use estimate
                    </button>
                  </>
                )}
              </>
            } />
        )}
        <Pair>
          <InputField label="Stamp duty" format="currency" value={p.stampDuty}
            onChange={(stampDuty) => onCityProperty({ stampDuty, state: undefined })}
            helpText={city?.state === 'avg' && !p.state
              ? 'Average across states at the median. Pick a state to calculate it from the price.'
              : stampDutyBasis(p.state, p.firstHomeBuyer ?? false)} />
          <InputField label="Other costs" format="currency" value={p.otherPurchaseCosts}
            onChange={(otherPurchaseCosts) => onPropertyChange({ ...p, otherPurchaseCosts })} />
        </Pair>
        {p.state && p.firstHomeBuyer && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[13px]">
              <span className="text-ink-2">First home owner grant</span>
              <span className="font-mono">{formatCurrency(p.firstHomeGrant ?? 0)}</span>
            </div>
            <span className="text-xs leading-snug text-muted">{grantNote(p)} Reduces the cash needed upfront.</span>
          </div>
        )}
      </Section>

      <Section title="The loan">
        {scenarioField('Interest rate', p.interestRate, (interestRate) => onPropertyChange({ ...p, interestRate }), 'interestRate')}
        <Pair>
          <InputField label="Term" format="years" value={p.loanTerm}
            onChange={(loanTerm) => onPropertyChange({ ...p, loanTerm })} />
          <InputField label="Offset balance" format="currency" value={p.offsetAccountBalance ?? 0}
            onChange={(offsetAccountBalance) => onPropertyChange({ ...p, offsetAccountBalance })} />
        </Pair>
        <p className="m-0 text-xs leading-relaxed text-muted">
          Repayment {formatCurrency(monthlyRepayment)}/month. Variable rate: repayments reset when the rate moves.
          The renter invests the offset balance instead.
        </p>
      </Section>

      <Section title="Renting instead">
        <Pair>
          <InputField label="Rent / month" format="currency" value={r.monthlyRent}
            onChange={(monthlyRent) => onPropertyAndRentChange({ ...p, location: undefined }, { ...r, monthlyRent })}
            {...explore('monthlyRent')} />
          <InputField label="Move every" format="years" value={r.movingFrequency}
            onChange={(movingFrequency) => onRentChange({ ...r, movingFrequency })} />
        </Pair>
        {scenarioField('Rent growth / year', r.rentIncreaseRate, (rentIncreaseRate) => onRentChange({ ...r, rentIncreaseRate }), 'rentIncreaseRate')}
      </Section>

      <Section title="Markets & tax">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-2">Invest savings in</span>
          <select
            className="input-field"
            value={inv.portfolio ?? 'custom'}
            onChange={(e) => {
              const preset = PORTFOLIOS.find((x) => x.id === e.target.value);
              if (preset) onInvestmentChange(applyPortfolio(inv, preset));
            }}
          >
            {PORTFOLIOS.map((x) => (
              <option key={x.id} value={x.id}>{x.name} ({x.example})</option>
            ))}
            <option value="custom" disabled={inv.portfolio !== undefined}>Custom</option>
          </select>
        </label>
        <InputField label="Share of the monthly saving invested" format="percent" value={inv.investedShare ?? 100}
          onChange={(investedShare) => onInvestmentChange({ ...inv, investedShare: Math.min(100, Math.max(0, investedShare)) })}
          helpText={INVESTED_SHARE_NOTE} />
        {scenarioField('Total return / year', inv.stockMarketReturn,
          (stockMarketReturn) => onPortfolioParam({ stockMarketReturn }), 'stockMarketReturn', 'percent',
          'Including dividends, before fees.')}
        {scenarioField('Property growth / year', inv.propertyGrowthRate,
          (propertyGrowthRate) => onInvestmentChange({ ...inv, propertyGrowthRate }), 'propertyGrowthRate', 'percent',
          p.newHome ? <>{NEW_HOME_GROWTH_SHORT} <NewHomeGrowthSources />{growthNote && <> {growthNote}</>}</> : growthNote)}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-2">Income tax rate (incl. 2% Medicare)</span>
          <select
            className="input-field"
            value={inv.marginalTaxRate}
            onChange={(e) => onInvestmentChange({ ...inv, marginalTaxRate: Number(e.target.value) })}
          >
            {TAX_BRACKETS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
      </Section>

      <details className="group border-b border-line">
        <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm [&::-webkit-details-marker]:hidden">
          <span>More assumptions</span>
          <span className="text-right text-xs text-muted">
            <span className="group-open:hidden">Maintenance, rates, insurance, fees</span>
            <span className="hidden group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="flex flex-col gap-3.5 px-5 pb-5">
          <InputField label="Maintenance / year" format="percent" value={p.maintenanceRate}
            onChange={(maintenanceRate) => onPropertyChange({ ...p, maintenanceRate })}
            helpText="Share of the property's value." {...explore('maintenanceRate')} />
          <Pair>
            <InputField label="Council & water / year" format="currency" value={p.councilRates}
              onChange={(councilRates) => onCityProperty({ councilRates })} />
            <InputField label="Building insurance" format="currency" value={p.buildingInsurance}
              onChange={(buildingInsurance) => onCityProperty({ buildingInsurance })} />
          </Pair>
          <Pair>
            <InputField label="Owner contents ins." format="currency" value={p.contentsInsurance}
              onChange={(contentsInsurance) => onPropertyChange({ ...p, contentsInsurance })} />
            <InputField label="Renter contents ins." format="currency" value={r.contentsInsurance}
              onChange={(contentsInsurance) => onRentChange({ ...r, contentsInsurance })} />
          </Pair>
          <Pair>
            <InputField label="Selling costs" format="percent" value={p.sellingCostRate}
              onChange={(sellingCostRate) => onPropertyChange({ ...p, sellingCostRate })} />
            <InputField label="Cost per move" format="currency" value={r.movingCost}
              onChange={(movingCost) => onRentChange({ ...r, movingCost })} />
          </Pair>
          <InputField label="CGT rate on the home" format="percent" value={p.capitalGainsTaxRate}
            onChange={(capitalGainsTaxRate) => onPropertyChange({ ...p, capitalGainsTaxRate })}
            helpText="0% for a main residence." />
          <Pair>
            <InputField label="Dividend yield" format="percent" value={inv.dividendYield ?? 0}
              onChange={(dividendYield) => onPortfolioParam({ dividendYield })} {...explore('dividendYield')} />
            <InputField label="Franked" format="percent" value={inv.frankingLevel ?? 0}
              onChange={(frankingLevel) => onPortfolioParam({ frankingLevel })} />
          </Pair>
          <span className="-mt-2 text-xs leading-snug text-muted">
            Part of the total return. ASX ~4% and ~80% franked; global shares ~1.5% and unfranked.
          </span>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-2">Dividends</span>
            <select
              className="input-field"
              value={String(inv.dividendReinvestment ?? true)}
              onChange={(e) => onInvestmentChange({ ...inv, dividendReinvestment: e.target.value === 'true' })}
            >
              <option value="true">Reinvest</option>
              <option value="false">Hold as cash</option>
            </select>
          </label>
          <Pair>
            <InputField label="Fund fee (MER)" format="percent" value={inv.managementFee ?? 0}
              onChange={(managementFee) => onPortfolioParam({ managementFee })} />
            <InputField label="Brokerage" format="percent" value={inv.stockTransactionCost}
              onChange={(stockTransactionCost) => onInvestmentChange({ ...inv, stockTransactionCost })} />
          </Pair>
          <InputField label="Inflation" format="percent" value={inv.inflationRate}
            onChange={(inflationRate) => onInvestmentChange({ ...inv, inflationRate })} />
        </div>
      </details>

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <label className="flex items-center gap-2.5 text-[13px] text-ink-2">
          Horizon
          <span className="w-24">
            {/* Clamped so a stray keystroke can't trigger a 10,000-year simulation */}
            <AdornedInput
              ariaLabel="Horizon"
              format="years"
              value={timeHorizon}
              onChange={(v) => onTimeHorizonChange(Math.max(1, Math.min(60, Math.round(v))))}
            />
          </span>
        </label>
        <span className="text-xs text-muted">Same savings, same budget</span>
      </div>
    </aside>
  );
}
