import type { PropertyInputs, RentInputs, InvestmentInputs, ScenarioValue } from '../types';
import InputField from './InputField';
import MultiInput from './MultiInput';
import FocusAnalysis from './FocusAnalysis';
import { isScenarioValue } from '../utils/calculations';

interface RentInputsCardProps {
  inputs: RentInputs;
  onChange: (inputs: RentInputs) => void;
  monthlySavings: number;
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

export default function RentInputsCard({
  inputs,
  onChange,
  monthlySavings,
  scenarioMode,
  focusMetric,
  onFocusMetric,
  allInputs,
}: RentInputsCardProps) {
  const handleRentIncreaseRateChange = (value: number | ScenarioValue) => {
    onChange({ ...inputs, rentIncreaseRate: value });
  };

  const handleFocusMode = (metric: string) => {
    onFocusMetric(focusMetric === metric ? null : metric);
  };

  return (
    <div className="p-6 rounded-lg shadow-xl bg-card border-l-4 border-accent">
      <h2 className="text-xl font-semibold mb-6 text-accent">Renting</h2>

      <InputField
        label="Monthly Rent"
        value={inputs.monthlyRent}
        onChange={(monthlyRent) => onChange({ ...inputs, monthlyRent })}
        onFocusMode={() => handleFocusMode('monthlyRent')}
      />

      {focusMetric === 'monthlyRent' && (
        <FocusAnalysis
          metricKey="monthlyRent"
          propertyInputs={allInputs.propertyInputs}
          rentInputs={allInputs.rentInputs}
          investmentInputs={allInputs.investmentInputs}
          timeHorizon={allInputs.timeHorizon}
        />
      )}

      {scenarioMode ? (
        <MultiInput
          label="Annual Rent Increase (%)"
          value={
            isScenarioValue(inputs.rentIncreaseRate)
              ? inputs.rentIncreaseRate
              : { pessimistic: inputs.rentIncreaseRate, baseline: inputs.rentIncreaseRate, optimistic: inputs.rentIncreaseRate }
          }
          onChange={handleRentIncreaseRateChange}
          onFocusMode={() => handleFocusMode('rentIncreaseRate')}
        />
      ) : (
        <InputField
          label="Annual Rent Increase (%)"
          value={isScenarioValue(inputs.rentIncreaseRate) ? inputs.rentIncreaseRate.baseline : inputs.rentIncreaseRate}
          onChange={(rentIncreaseRate) => onChange({ ...inputs, rentIncreaseRate })}
          onFocusMode={() => handleFocusMode('rentIncreaseRate')}
        />
      )}

      {focusMetric === 'rentIncreaseRate' && (
        <FocusAnalysis
          metricKey="rentIncreaseRate"
          propertyInputs={allInputs.propertyInputs}
          rentInputs={allInputs.rentInputs}
          investmentInputs={allInputs.investmentInputs}
          timeHorizon={allInputs.timeHorizon}
        />
      )}

      <InputField
        label="Move Every (years)"
        value={inputs.movingFrequency}
        onChange={(movingFrequency) => onChange({ ...inputs, movingFrequency })}
      />

      <InputField
        label="Cost Per Move"
        value={inputs.movingCost}
        onChange={(movingCost) => onChange({ ...inputs, movingCost })}
        helpText="Bond, removalists, cleaning"
      />

      <InputField
        label="Contents Insurance (annual)"
        value={inputs.contentsInsurance}
        onChange={(contentsInsurance) => onChange({ ...inputs, contentsInsurance })}
      />

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-sm text-text-secondary">Monthly Savings vs Mortgage:</p>
        <p className="text-2xl font-semibold mt-1 text-accent">
          ${monthlySavings.toFixed(0)}
        </p>
        <p className="text-xs mt-2 text-text-secondary opacity-70">
          Invested in stock market each month
        </p>
      </div>
    </div>
  );
}
