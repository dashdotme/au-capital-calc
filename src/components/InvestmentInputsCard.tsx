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
        step="0.1"
      />

      <InputField
        label="Property Growth Rate (% p.a.)"
        value={inputs.propertyGrowthRate}
        onChange={(propertyGrowthRate) => onChange({ ...inputs, propertyGrowthRate })}
        step="0.1"
      />

      <InputField
        label="CGT Rate on Stocks (%)"
        value={inputs.capitalGainsTaxRateStocks}
        onChange={(capitalGainsTaxRateStocks) =>
          onChange({ ...inputs, capitalGainsTaxRateStocks })
        }
        step="0.1"
        helpText="After 50% CGT discount (AU)"
      />

      <InputField
        label="Time Horizon (years)"
        value={timeHorizon}
        onChange={onTimeHorizonChange}
      />
    </div>
  );
}
