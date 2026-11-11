import type { ReactNode } from 'react';
import { MAX_IO_YEARS, type IpInputs } from '../utils/investmentProperty';
import { AU_STATES, isAuState } from '../utils/stampDuty';
import { IP_SHARE_PRESETS, ipPortfolio, ipPortfolioFields } from '../utils/shareState';
import InputField from './InputField';
import Segmented from './Segmented';
import { landTaxToday } from '../utils/landTax';
import { formatCurrency } from '../utils/format';

function Group({ title, children, open = true, hint }: { title: string; children: ReactNode; open?: boolean; hint?: string }) {
  return (
    <details open={open} className="group border-b border-line last:border-b-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-right text-xs font-normal text-muted">
          <span className="group-open:hidden">{hint ?? 'Show'}</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 px-5 pb-5">{children}</div>
    </details>
  );
}

const Wide = ({ children }: { children: ReactNode }) => <div className="col-span-2 flex flex-col gap-1.5 [&>[role=group]>button]:flex-1">{children}</div>;

/** Every input for the property-or-shares comparison, grouped like the rent-or-buy assumptions. */
export default function InvestAssumptions({ input, onChange, onReset }: {
  input: IpInputs;
  onChange: (patch: Partial<IpInputs>) => void;
  onReset: () => void;
}) {
  const set = onChange;
  const isNew = input.kind === 'new';
  const portfolio = ipPortfolio(input);

  return (
    <aside id="assumptions" aria-label="Assumptions" className="card scroll-mt-4 overflow-hidden p-0">
      <Group title="The property">
        <Wide>
          <span className="text-[13px] text-ink-2">Type</span>
          <Segmented label="Property type" value={input.kind} onChange={(kind) => set({ kind })}
            options={[{ value: 'new', label: 'New build' }, { value: 'established', label: 'Established' }]} />
          <span className="text-xs leading-snug text-muted">
            {isNew
              ? 'House-and-land or off-the-plan. Keeps negative gearing, and can pick the 50% discount at sale.'
              : 'Losses from July 2027 only offset rental income and the eventual gain; they carry forward.'}
          </span>
        </Wide>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-2">State</span>
          <select className="input-field" value={input.state} onChange={(e) => isAuState(e.target.value) && set({ state: e.target.value })}>
            {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <InputField label="Price" format="currency" value={input.price} onChange={(price) => set({ price })} />
        <InputField label="Land share" format="percent" value={input.landShare} onChange={(landShare) => set({ landShare })}
          helpText={isNew ? 'Duty is on the land only.' : 'Upkeep is on the building.'} />
        {isNew
          ? <InputField label="Build time" format="number" value={input.buildMonths} onChange={(buildMonths) => set({ buildMonths })} helpText="Months, no rent." />
          : <InputField label="Building cost" format="currency" value={input.capitalWorksBase} onChange={(capitalWorksBase) => set({ capitalWorksBase })}
              helpText="For 2.5% a year depreciation; 0 if built before 1987." />}
        <InputField label="Loan" format="percent" value={input.lvr} onChange={(lvr) => set({ lvr: Math.max(0, Math.min(100, lvr)) })} helpText="Of the price." />
        <InputField label="Interest rate" format="percent" value={input.interestRate} onChange={(interestRate) => set({ interestRate })} />
        <InputField label="Interest-only years" format="years" value={input.ioYears}
          onChange={(ioYears) => set({ ioYears: Math.max(0, Math.min(MAX_IO_YEARS, Math.round(ioYears))) })}
          helpText={`Then principal and interest; 0 for P&I. Up to ${MAX_IO_YEARS}.`} />
        <InputField label="Price growth" format="percent" value={input.growth} onChange={(growth) => set({ growth })} helpText="A year." />
        <InputField label="Gross yield" format="percent" value={input.grossYield} onChange={(grossYield) => set({ grossYield })} helpText="Rent ÷ value." />
        <InputField label="Rent growth" format="percent" value={input.rentGrowth} onChange={(rentGrowth) => set({ rentGrowth })} helpText="A year." />
      </Group>

      <Group title="Running costs" open={false} hint="Agent, vacancy, rates, upkeep">
        <InputField label="Management" format="percent" value={input.management} onChange={(management) => set({ management })} helpText="Of rent, incl. GST." />
        <InputField label="Vacancy" format="percent" value={input.vacancy} onChange={(vacancy) => set({ vacancy })} helpText="Of the year." />
        <InputField label="Insurance / yr" format="currency" value={input.insurance} onChange={(insurance) => set({ insurance })} />
        <InputField label="Council & water / yr" format="currency" value={input.councilRates} onChange={(councilRates) => set({ councilRates })} />
        <InputField label="Strata / yr" format="currency" value={input.strata} onChange={(strata) => set({ strata })} />
        <p className="col-span-2 m-0 text-xs leading-snug text-muted">
          Land tax is worked out from {input.state}'s 2026–27 schedule on the land's value
          ({formatCurrency(landTaxToday(input.state, input.price * (input.landShare / 100)))} this year), assuming it's your only
          investment property. Thresholds stay put as land values rise.
        </p>
        <InputField label="Maintenance" format="percent" value={input.maintenance} onChange={(maintenance) => set({ maintenance })} helpText="Of the building, a year." />
        {isNew && <InputField label="Fittings" format="currency" value={input.plant} onChange={(plant) => set({ plant })} helpText="Depreciable plant." />}
        <InputField label="Purchase costs" format="currency" value={input.purchaseCosts} onChange={(purchaseCosts) => set({ purchaseCosts })} helpText="Besides duty." />
        <InputField label="Selling costs" format="percent" value={input.sellingCosts} onChange={(sellingCosts) => set({ sellingCosts })} />
      </Group>

      <Group title="The shares">
        <Wide>
          <span className="text-[13px] text-ink-2">Portfolio</span>
          <select className="input-field" value={portfolio?.id ?? 'custom'} onChange={(e) => {
            const p = IP_SHARE_PRESETS.find((x) => x.id === e.target.value);
            if (p) set(ipPortfolioFields(p));
          }}>
            {IP_SHARE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.example})</option>)}
            <option value="custom" disabled>Custom</option>
          </select>
        </Wide>
        <InputField label="Total return" format="percent" value={input.etfReturn} onChange={(etfReturn) => set({ etfReturn })} helpText="Before fees." />
        <InputField label="Fee" format="percent" value={input.etfFee} onChange={(etfFee) => set({ etfFee })} />
        <InputField label="Distribution yield" format="percent" value={input.etfYield} onChange={(etfYield) => set({ etfYield })} />
        <InputField label="Franked" format="percent" value={input.franking} onChange={(franking) => set({ franking })} />
      </Group>

      <Group title="You and the tax rules">
        <InputField label="Salary" format="currency" value={input.salary} onChange={(salary) => set({ salary })} />
        <InputField label="Pay rises" format="percent" value={input.salaryGrowth} onChange={(salaryGrowth) => set({ salaryGrowth })} helpText="A year." />
        <InputField label="Inflation" format="percent" value={input.inflation} onChange={(inflation) => set({ inflation })} helpText="Indexes gains." />
        <InputField label="Years shown" format="years" value={input.years} onChange={(years) => set({ years: Math.min(40, Math.max(1, Math.round(years))) })}
          helpText="Pick when to sell on the chart." />
        <Wide>
          <Segmented label="Tax rules" value={input.rules} onChange={(rules) => set({ rules })}
            options={[{ value: 'reform', label: 'From July 2027 (law)' }, { value: 'old', label: 'Old rules' }]} />
          <span className="text-xs leading-snug text-muted">
            {input.rules === 'reform'
              ? 'CGT indexation with a 30% minimum tax, for shares too; gains before July 2027 keep the discount.'
              : 'For comparison: the 50% discount and negative gearing for everything.'}
          </span>
        </Wide>
        <Wide>
          <button type="button" onClick={onReset} className="min-h-10 rounded-lg border border-line px-3 text-sm text-ink-2 hover:text-ink">
            Reset to defaults
          </button>
        </Wide>
      </Group>
    </aside>
  );
}
