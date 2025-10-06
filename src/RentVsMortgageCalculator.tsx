import { useState, useMemo } from 'react';
import type { PropertyInputs, RentInputs, InvestmentInputs } from './types';
import { calculateMortgagePayment, runComparison } from './utils/calculations';
import PropertyInputsCard from './components/PropertyInputsCard';
import RentInputsCard from './components/RentInputsCard';
import InvestmentInputsCard from './components/InvestmentInputsCard';
import ResultsSummary from './components/ResultsSummary';
import ComparisonChart from './components/ComparisonChart';

export default function RentVsMortgageCalculator() {
  const [propertyInputs, setPropertyInputs] = useState<PropertyInputs>({
    propertyPrice: 900000,
    deposit: 180000,
    loanTerm: 30,
    interestRate: 4.5,
    stampDuty: 0,
    otherPurchaseCosts: 10000,
    maintenanceRate: 1.0,
    councilRates: 2500,
    buildingInsurance: 1400,
    contentsInsurance: 1000,
    sellingCostRate: 3.0,
    capitalGainsTaxRate: 0,
  });

  const [rentInputs, setRentInputs] = useState<RentInputs>({
    monthlyRent: 3000,
    rentIncreaseRate: 3,
    movingFrequency: 3,
    movingCost: 2000,
    contentsInsurance: 1200,
  });

  const [investmentInputs, setInvestmentInputs] = useState<InvestmentInputs>({
    stockMarketReturn: 8,
    propertyGrowthRate: 4.5,
    marginalTaxRate: 37,
    inflationRate: 2.5,
    stockTransactionCost: 0.1,
  });

  const [timeHorizon, setTimeHorizon] = useState(30);

  const results = useMemo(
    () => runComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon),
    [propertyInputs, rentInputs, investmentInputs, timeHorizon]
  );

  const loanAmount = propertyInputs.propertyPrice - propertyInputs.deposit;
  const monthlyMortgage = calculateMortgagePayment(
    loanAmount,
    propertyInputs.interestRate,
    propertyInputs.loanTerm
  );

  const finalResult = results[results.length - 1];
  const advantageBeforeTax =
    finalResult.rentNetPosition - finalResult.mortgageNetPosition;
  const advantageAfterTax =
    finalResult.rentNetPositionAfterTax - finalResult.mortgageNetPositionAfterSale;

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-primary">
      <h1 className="text-4xl font-bold mb-8 text-accent">
        AU Rent vs Mortgage Calculator
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <PropertyInputsCard
          inputs={propertyInputs}
          onChange={setPropertyInputs}
          monthlyPayment={monthlyMortgage}
        /><RentInputsCard
          inputs={rentInputs}
          onChange={setRentInputs}
          monthlySavings={monthlyMortgage - rentInputs.monthlyRent}
        />

        <InvestmentInputsCard
          inputs={investmentInputs}
          onChange={setInvestmentInputs}
          timeHorizon={timeHorizon}
          onTimeHorizonChange={setTimeHorizon}
        />
      </div>

      <ResultsSummary
        timeHorizon={timeHorizon}
        finalResult={finalResult}
        advantageBeforeTax={advantageBeforeTax}
        advantageAfterTax={advantageAfterTax}
      />

      <ComparisonChart results={results} />
    </div>
  );
}
