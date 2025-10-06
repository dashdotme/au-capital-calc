import type { InvestmentInputs } from '../types';
import InputField from './InputField';

interface InvestmentInputsCardProps {
  inputs: InvestmentInputs;
  onChange: (inputs: InvestmentInputs) => void;
  timeHorizon: number;
  onTimeHorizonChange: (years: number) => void;
}

export default function InvestmentInputsCard({
  inputs,
  onChange,
  timeHorizon,
  onTimeHorizonChange,
}: InvestmentInputsCardProps) {
  return (
    <div className="p-6 rounded-lg shadow-xl bg-card border-l-4 border-accent">
      <h2 className="text-xl font-semibold mb-6 text-accent">Investment Returns</h2>

      <InputField
        label="Stock Market Return (% p.a.)"
        value={inputs.stockMarketReturn}
        onChange={(stockMarketReturn) => onChange({ ...inputs, stockMarketReturn })}
      />

      <InputField
        label="Property Growth Rate (% p.a.)"
        value={inputs.propertyGrowthRate}
        onChange={(propertyGrowthRate) => onChange({ ...inputs, propertyGrowthRate })}
      />

      <InputField
        label="Inflation Rate (% p.a.)"
        value={inputs.inflationRate}
        onChange={(inflationRate) => onChange({ ...inputs, inflationRate })}
        helpText="For insurance and general costs"
      />

      <InputField
        label="Stock Transaction Costs (%)"
        value={inputs.stockTransactionCost}
        onChange={(stockTransactionCost) => onChange({ ...inputs, stockTransactionCost })}
        helpText="Typical: 0.1-0.2% for index funds, 0.5%+ for active trading. Higher if investing abroad. Applied to each monthly contribution."
      />

      <label className="block mb-4">
        <span className="text-sm block mb-1 text-[var(--color-text-secondary)]">
          Your Marginal Tax Rate
        </span>
        <select
          value={inputs.marginalTaxRate}
          onChange={(e) => onChange({ ...inputs, marginalTaxRate: Number(e.target.value) })}
          className="input-field"
        >
          <option value="19">19% ($18,201 - $45,000)</option>
          <option value="32.5">32.5% ($45,001 - $135,000)</option>
          <option value="37">37% ($135,001 - $190,000)</option>
          <option value="45">45% ($190,001+)</option>
        </select>
        <span className="text-xs mt-1 block text-[var(--color-text-secondary)] opacity-70">
          Calculator assumes assets are held for 12 months, meaning capital is taxed at 50% of this rate.
        </span>
      </label>

      <InputField
        label="Time Horizon (years)"
        value={timeHorizon}
        onChange={onTimeHorizonChange}
      />
    </div>
  );
}
