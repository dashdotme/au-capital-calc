import type { PropertyInputs, RentInputs, InvestmentInputs, ScenarioValue } from '../types';
import InputField from './InputField';
import MultiInput from './MultiInput';
import FocusAnalysis from './FocusAnalysis';
import { isScenarioValue } from '../utils/calculations';

interface InvestmentInputsCardProps {
  inputs: InvestmentInputs;
  onChange: (inputs: InvestmentInputs) => void;
  timeHorizon: number;
  onTimeHorizonChange: (years: number) => void;
  scenarioMode: boolean;
  focusMetric: string | null;
  onFocusMetric: (metric: string | null) => void;
  allInputs: {
    propertyInputs: PropertyInputs;
    rentInputs: RentInputs;
    investmentInputs: InvestmentInputs;
    timeHorizon: number;
  };
}

export default function InvestmentInputsCard({
  inputs,
  onChange,
  timeHorizon,
  onTimeHorizonChange,
  scenarioMode,
  focusMetric,
  onFocusMetric,
  allInputs,
}: InvestmentInputsCardProps) {
  const handleStockMarketReturnChange = (value: number | ScenarioValue) => {
    onChange({ ...inputs, stockMarketReturn: value });
  };

  const handlePropertyGrowthRateChange = (value: number | ScenarioValue) => {
    onChange({ ...inputs, propertyGrowthRate: value });
  };

  const handleFocusMode = (metric: string) => {
    onFocusMetric(focusMetric === metric ? null : metric);
  };

  return (
    <div className="p-6 rounded-lg shadow-xl bg-card border-l-4 border-accent">
      <h2 className="text-xl font-semibold mb-6 text-accent">Investment Returns</h2>

      {scenarioMode ? (
        <MultiInput
          label="Stock Market Total Return (% p.a.)"
          value={
            isScenarioValue(inputs.stockMarketReturn)
              ? inputs.stockMarketReturn
              : { pessimistic: inputs.stockMarketReturn, baseline: inputs.stockMarketReturn, optimistic: inputs.stockMarketReturn }
          }
          onChange={handleStockMarketReturnChange}
          onFocusMode={() => handleFocusMode('stockMarketReturn')}
        />
      ) : (
        <InputField
          label="Stock Market Total Return (% p.a.)"
          value={isScenarioValue(inputs.stockMarketReturn) ? inputs.stockMarketReturn.baseline : inputs.stockMarketReturn}
          onChange={(stockMarketReturn) => onChange({ ...inputs, stockMarketReturn })}
          onFocusMode={() => handleFocusMode('stockMarketReturn')}
        />
      )}

      {focusMetric === 'stockMarketReturn' && (
        <FocusAnalysis
          metricKey="stockMarketReturn"
          propertyInputs={allInputs.propertyInputs}
          rentInputs={allInputs.rentInputs}
          investmentInputs={allInputs.investmentInputs}
          timeHorizon={allInputs.timeHorizon}
        />
      )}

      <InputField
        label="Dividend Yield (% p.a.)"
        value={inputs.dividendYield ?? 0}
        onChange={(dividendYield) => onChange({ ...inputs, dividendYield })}
        helpText="Part of the total return, not extra. ASX average ~4%, US markets ~1.5 - 2%. Higher yield means more tax drag."
        onFocusMode={() => handleFocusMode('dividendYield')}
      />

      {focusMetric === 'dividendYield' && (
        <FocusAnalysis
          metricKey="dividendYield"
          propertyInputs={allInputs.propertyInputs}
          rentInputs={allInputs.rentInputs}
          investmentInputs={allInputs.investmentInputs}
          timeHorizon={allInputs.timeHorizon}
        />
      )}

      <InputField
        label="Franking Level (%)"
        value={inputs.frankingLevel ?? 0}
        onChange={(frankingLevel) => onChange({ ...inputs, frankingLevel })}
        helpText="% of dividends fully franked. ASX average ~80%, international stocks 0%"
      />

      <label className="block mb-4">
        <span className="text-sm block mb-1 text-[var(--color-text-secondary)]">
          Dividend Reinvestment
        </span>
        <select
          value={String(inputs.dividendReinvestment ?? true)}
          onChange={(e) => onChange({ ...inputs, dividendReinvestment: e.target.value === 'true' })}
          className="input-field"
        >
          <option value="true">Reinvest dividends</option>
          <option value="false">Take as cash (held, not invested)</option>
        </select>
      </label>

      {scenarioMode ? (
        <MultiInput
          label="Property Growth Rate (% p.a.)"
          value={
            isScenarioValue(inputs.propertyGrowthRate)
              ? inputs.propertyGrowthRate
              : { pessimistic: inputs.propertyGrowthRate, baseline: inputs.propertyGrowthRate, optimistic: inputs.propertyGrowthRate }
          }
          onChange={handlePropertyGrowthRateChange}
          onFocusMode={() => handleFocusMode('propertyGrowthRate')}
        />
      ) : (
        <InputField
          label="Property Growth Rate (% p.a.)"
          value={isScenarioValue(inputs.propertyGrowthRate) ? inputs.propertyGrowthRate.baseline : inputs.propertyGrowthRate}
          onChange={(propertyGrowthRate) => onChange({ ...inputs, propertyGrowthRate })}
          onFocusMode={() => handleFocusMode('propertyGrowthRate')}
        />
      )}

      {focusMetric === 'propertyGrowthRate' && (
        <FocusAnalysis
          metricKey="propertyGrowthRate"
          propertyInputs={allInputs.propertyInputs}
          rentInputs={allInputs.rentInputs}
          investmentInputs={allInputs.investmentInputs}
          timeHorizon={allInputs.timeHorizon}
        />
      )}

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
        helpText="Typical: 0.1 - 0.2% for index funds, 0.5%+ for active trading. Higher if investing abroad. Applied to each purchase and the final sale."
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
          <option value="18">16% + 2% Medicare ($18,201 - $45,000)</option>
          <option value="32">30% + 2% Medicare ($45,001 - $135,000)</option>
          <option value="39">37% + 2% Medicare ($135,001 - $190,000)</option>
          <option value="47">45% + 2% Medicare ($190,001+)</option>
        </select>
        <span className="text-xs mt-1 block text-[var(--color-text-secondary)] opacity-70">
          Applied to dividends (net of franking credits) and to capital gains after the 50% CGT discount.
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
