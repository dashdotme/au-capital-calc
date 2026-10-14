import type { PropertyInputs, RentInputs, InvestmentInputs, ScenarioValue } from '../types';
import InputField from './InputField';
import MultiInput from './MultiInput';
import FocusAnalysis from './FocusAnalysis';
import { isScenarioValue } from '../utils/calculations';

interface PropertyInputsCardProps {
  inputs: PropertyInputs;
  onChange: (inputs: PropertyInputs) => void;
  monthlyPayment: number;
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

export default function PropertyInputsCard({
  inputs,
  onChange,
  monthlyPayment,
  scenarioMode,
  focusMetric,
  onFocusMetric,
  allInputs,
}: PropertyInputsCardProps) {
  const handleInterestRateChange = (value: number | ScenarioValue) => {
    onChange({ ...inputs, interestRate: value });
  };

  const handleFocusMode = (metric: string) => {
    onFocusMetric(focusMetric === metric ? null : metric);
  };

  const lvr = inputs.propertyPrice > 0
    ? ((inputs.propertyPrice - inputs.deposit) / inputs.propertyPrice) * 100
    : 0;

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
        helpText={`LVR ${lvr.toFixed(1)}%${lvr > 80 ? ' - above 80%, so lenders usually charge LMI' : ''}`}
      />

      {(lvr > 80 || (inputs.lmi ?? 0) > 0) && (
        <InputField
          label="Lenders Mortgage Insurance"
          value={inputs.lmi ?? 0}
          onChange={(lmi) => onChange({ ...inputs, lmi })}
          helpText="Added to the loan. Ask your lender for a quote; first home buyer schemes can waive it."
        />
      )}

      {scenarioMode ? (
        <MultiInput
          label="Interest Rate (%)"
          value={
            isScenarioValue(inputs.interestRate)
              ? inputs.interestRate
              : { pessimistic: inputs.interestRate, baseline: inputs.interestRate, optimistic: inputs.interestRate }
          }
          onChange={handleInterestRateChange}
          onFocusMode={() => handleFocusMode('interestRate')}
        />
      ) : (
        <InputField
          label="Interest Rate (%)"
          value={isScenarioValue(inputs.interestRate) ? inputs.interestRate.baseline : inputs.interestRate}
          onChange={(interestRate) => onChange({ ...inputs, interestRate })}
          onFocusMode={() => handleFocusMode('interestRate')}
        />
      )}

      {focusMetric === 'interestRate' && (
        <FocusAnalysis
          metricKey="interestRate"
          propertyInputs={allInputs.propertyInputs}
          rentInputs={allInputs.rentInputs}
          investmentInputs={allInputs.investmentInputs}
          timeHorizon={allInputs.timeHorizon}
        />
      )}

      <InputField
        label="Loan Term (years)"
        value={inputs.loanTerm}
        onChange={(loanTerm) => onChange({ ...inputs, loanTerm })}
      />

      <InputField
        label="Offset Account Balance"
        value={inputs.offsetAccountBalance ?? 0}
        onChange={(offsetAccountBalance) => onChange({ ...inputs, offsetAccountBalance })}
        helpText="Extra savings kept in an offset. The renter invests the same amount instead, so both start equal."
      />

      <InputField
        label="Stamp Duty"
        value={inputs.stampDuty}
        onChange={(stampDuty) => onChange({ ...inputs, stampDuty })}
        helpText={
          <>
            State tax on property purchase (minimal for new builds, ~3-5% for established).{' '}
            <a
              href="https://www.commbank.com.au/digital/home-buying/calculator/stamp-duty-calculator"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-accent"
            >
              Calculator here.
            </a>
          </>
        }
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
        onFocusMode={() => handleFocusMode('maintenanceRate')}
      />

      {focusMetric === 'maintenanceRate' && (
        <FocusAnalysis
          metricKey="maintenanceRate"
          propertyInputs={allInputs.propertyInputs}
          rentInputs={allInputs.rentInputs}
          investmentInputs={allInputs.investmentInputs}
          timeHorizon={allInputs.timeHorizon}
        />
      )}

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
          Monthly Repayment:{' '}
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
