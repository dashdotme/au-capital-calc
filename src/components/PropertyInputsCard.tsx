import type { PropertyInputs } from '../types';
import InputField from './InputField';

interface PropertyInputsCardProps {
  inputs: PropertyInputs;
  onChange: (inputs: PropertyInputs) => void;
  monthlyPayment: number;
}

export default function PropertyInputsCard({
  inputs,
  onChange,
  monthlyPayment,
}: PropertyInputsCardProps) {
  return (
    <div className="p-6 rounded-lg shadow-xl bg-card border-l-4 border-accent">
      <h2 className="text-xl font-semibold mb-6 text-accent">Property Purchase</h2>

      <InputField
        label="Property Price"
        value={inputs.propertyPrice}
        onChange={(propertyPrice) => onChange({ ...inputs, propertyPrice })}
      />

      <InputField
        label="Deposit"
        value={inputs.deposit}
        onChange={(deposit) => onChange({ ...inputs, deposit })}
      />

      <InputField
        label="Interest Rate (%)"
        value={inputs.interestRate}
        onChange={(interestRate) => onChange({ ...inputs, interestRate })}
      />

      <InputField
        label="Loan Term (years)"
        value={inputs.loanTerm}
        onChange={(loanTerm) => onChange({ ...inputs, loanTerm })}
      />

      <InputField
        label="Stamp Duty"
        value={inputs.stampDuty}
        onChange={(stampDuty) => onChange({ ...inputs, stampDuty })}
      />

      <InputField
        label="Other Costs"
        value={inputs.otherPurchaseCosts}
        onChange={(otherPurchaseCosts) => onChange({ ...inputs, otherPurchaseCosts })}
        helpText="Conveyancing, inspections, etc."
      />

      <InputField
        label="Maintenance Rate (% p.a.)"
        value={inputs.maintenanceRate}
        onChange={(maintenanceRate) => onChange({ ...inputs, maintenanceRate })}
      />

      <InputField
        label="Council Rates (annual)"
        value={inputs.councilRates}
        onChange={(councilRates) => onChange({ ...inputs, councilRates })}
      />

      <InputField
        label="Building Insurance (annual)"
        value={inputs.buildingInsurance}
        onChange={(buildingInsurance) => onChange({ ...inputs, buildingInsurance })}
      />

      <InputField
        label="Contents Insurance (annual)"
        value={inputs.contentsInsurance}
        onChange={(contentsInsurance) => onChange({ ...inputs, contentsInsurance })}
      />

      <InputField
        label="Selling Costs (%)"
        value={inputs.sellingCostRate}
        onChange={(sellingCostRate) => onChange({ ...inputs, sellingCostRate })}
        helpText="Agent fees, marketing, legal"
      />

      <InputField
        label="CGT Rate on Property (%)"
        value={inputs.capitalGainsTaxRate}
        onChange={(capitalGainsTaxRate) => onChange({ ...inputs, capitalGainsTaxRate })}
        helpText="0% for primary residence (AU)"
      />

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-sm text-text-secondary">
          Monthly Payment:{' '}
          <strong className="text-2xl ml-2 text-accent">
            ${monthlyPayment.toFixed(0)}
          </strong>
        </p>
        <p className="text-xs mt-2 text-text-secondary opacity-70">
          + Maintenance, Rates & Insurance
        </p>
      </div>
    </div>
  );
}
