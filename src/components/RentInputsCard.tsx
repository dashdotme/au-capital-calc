import type { RentInputs } from '../types';
import InputField from './InputField';

interface RentInputsCardProps {
  inputs: RentInputs;
  onChange: (inputs: RentInputs) => void;
  monthlySavings: number;
}

export default function RentInputsCard({
  inputs,
  onChange,
  monthlySavings,
}: RentInputsCardProps) {
  return (
    <div className="p-6 rounded-lg shadow-xl bg-card border-l-4 border-accent">
      <h2 className="text-xl font-semibold mb-6 text-accent">Renting</h2>

      <InputField
        label="Monthly Rent"
        value={inputs.monthlyRent}
        onChange={(monthlyRent) => onChange({ ...inputs, monthlyRent })}
      />

      <InputField
        label="Annual Rent Increase (%)"
        value={inputs.rentIncreaseRate}
        onChange={(rentIncreaseRate) => onChange({ ...inputs, rentIncreaseRate })}
        step="0.1"
      />

      <InputField
        label="Move Every (years)"
        value={inputs.movingFrequency}
        onChange={(movingFrequency) => onChange({ ...inputs, movingFrequency })}
        min="1"
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
