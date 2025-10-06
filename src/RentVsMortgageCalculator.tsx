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
    propertyPrice: 800000,
    deposit: 160000,
    loanTerm: 30,
    interestRate: 6.5,
    stampDuty: 32000,
    otherPurchaseCosts: 8000,
    maintenanceRate: 1.0,
    councilRates: 2500,
    buildingInsurance: 1200,
    contentsInsurance: 500,
    sellingCostRate: 3.0,
    capitalGainsTaxRate: 0,
  });

  const [rentInputs, setRentInputs] = useState<RentInputs>({
    monthlyRent: 2800,
    rentIncreaseRate: 3.5,
    movingFrequency: 3,
    movingCost: 2000,
    contentsInsurance: 400,
  });

  const [investmentInputs, setInvestmentInputs] = useState<InvestmentInputs>({
    stockMarketReturn: 8.5,
    propertyGrowthRate: 5.0,
    capitalGainsTaxRateStocks: 23.5,
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
        Rent vs Mortgage Calculator
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
