import { useState, useMemo } from 'react';
import type { PropertyInputs, RentInputs, InvestmentInputs } from './types';
import { calculateMortgagePayment, runComparison, runScenarioComparison, isScenarioValue } from './utils/calculations';
import PropertyInputsCard from './components/PropertyInputsCard';
import RentInputsCard from './components/RentInputsCard';
import InvestmentInputsCard from './components/InvestmentInputsCard';
import ResultsSummary from './components/ResultsSummary';
import ComparisonChart from './components/ComparisonChart';
import ScenarioToggle from './components/ScenarioToggle';

export default function RentVsMortgageCalculator() {
  const [propertyInputs, setPropertyInputs] = useState<PropertyInputs>({
    propertyPrice: 900000,
    deposit: 180000,
    loanTerm: 30,
    interestRate: {
      pessimistic: 6.5,
      baseline: 4.5,
      optimistic: 3.5,
    },
    stampDuty: 30000,
    otherPurchaseCosts: 10000,
    maintenanceRate: 1.0,
    councilRates: 2500,
    buildingInsurance: 1400,
    contentsInsurance: 1000,
    sellingCostRate: 3.0,
    capitalGainsTaxRate: 0,
    offsetAccountBalance: 50000,
  });

  const [rentInputs, setRentInputs] = useState<RentInputs>({
    monthlyRent: 3000,
    rentIncreaseRate: {
      pessimistic: 5,
      baseline: 3,
      optimistic: 2,
    },
    movingFrequency: 3,
    movingCost: 2000,
    contentsInsurance: 1200,
  });

  const [investmentInputs, setInvestmentInputs] = useState<InvestmentInputs>({
    stockMarketReturn: {
      pessimistic: 6,
      baseline: 8,
      optimistic: 10,
    },
    propertyGrowthRate: {
      pessimistic: 3,
      baseline: 4.5,
      optimistic: 6,
    },
    marginalTaxRate: 37,
    inflationRate: 2.5,
    stockTransactionCost: 0.1,
    dividendYield: 1.5,
    frankingLevel: 0,
    dividendReinvestment: true,
  });

  const [timeHorizon, setTimeHorizon] = useState(30);
  const [scenarioMode, setScenarioMode] = useState(true);
  const [focusMetric, setFocusMetric] = useState<string | null>(null);

  const hasScenarioValues = useMemo(() => {
    return (
      isScenarioValue(propertyInputs.interestRate) ||
      isScenarioValue(rentInputs.rentIncreaseRate) ||
      isScenarioValue(investmentInputs.stockMarketReturn) ||
      isScenarioValue(investmentInputs.propertyGrowthRate)
    );
  }, [propertyInputs.interestRate, rentInputs.rentIncreaseRate, investmentInputs.stockMarketReturn, investmentInputs.propertyGrowthRate]);

  const results = useMemo(() => {
    if (scenarioMode && hasScenarioValues) {
      return runScenarioComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon);
    }
    return null;
  }, [scenarioMode, hasScenarioValues, propertyInputs, rentInputs, investmentInputs, timeHorizon]);

  const singleResults = useMemo(() => {
    if (!scenarioMode || !hasScenarioValues) {
      return runComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon);
    }
    return null;
  }, [scenarioMode, hasScenarioValues, propertyInputs, rentInputs, investmentInputs, timeHorizon]);

  const loanAmount = propertyInputs.propertyPrice - propertyInputs.deposit;
  const interestRateForPayment = isScenarioValue(propertyInputs.interestRate)
    ? propertyInputs.interestRate.baseline
    : propertyInputs.interestRate;
  const monthlyMortgage = calculateMortgagePayment(
    loanAmount,
    interestRateForPayment,
    propertyInputs.loanTerm
  );

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-primary">
      <h1 className="text-4xl font-bold mb-8 text-accent">
        AU Rent vs Mortgage Calculator
      </h1>
      <ScenarioToggle enabled={scenarioMode} onChange={setScenarioMode} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <PropertyInputsCard
          inputs={propertyInputs}
          onChange={setPropertyInputs}
          monthlyPayment={monthlyMortgage}
          scenarioMode={scenarioMode}
          focusMetric={focusMetric}
          onFocusMetric={setFocusMetric}
          allInputs={{ propertyInputs, rentInputs, investmentInputs, timeHorizon }}
        />
        <RentInputsCard
          inputs={rentInputs}
          onChange={setRentInputs}
          monthlySavings={monthlyMortgage - rentInputs.monthlyRent}
          scenarioMode={scenarioMode}
          focusMetric={focusMetric}
          onFocusMetric={setFocusMetric}
          allInputs={{ propertyInputs, rentInputs, investmentInputs, timeHorizon }}
        />
        <InvestmentInputsCard
          inputs={investmentInputs}
          onChange={setInvestmentInputs}
          timeHorizon={timeHorizon}
          onTimeHorizonChange={setTimeHorizon}
          scenarioMode={scenarioMode}
          focusMetric={focusMetric}
          onFocusMetric={setFocusMetric}
          allInputs={{ propertyInputs, rentInputs, investmentInputs, timeHorizon }}
        />
      </div>
      {scenarioMode && hasScenarioValues && results ? (
        <>
          <ResultsSummary
            timeHorizon={timeHorizon}
            scenarioResults={results}
          />
          <ComparisonChart scenarioResults={results} />
        </>
      ) : singleResults ? (
        <>
          <ResultsSummary
            timeHorizon={timeHorizon}
            finalResult={singleResults[singleResults.length - 1]}
            advantageBeforeTax={
              singleResults[singleResults.length - 1].rentNetPosition -
              singleResults[singleResults.length - 1].mortgageNetPosition
            }
            advantageAfterTax={
              singleResults[singleResults.length - 1].rentNetPositionAfterTax -
              singleResults[singleResults.length - 1].mortgageNetPositionAfterSale
            }
          />
          <ComparisonChart results={singleResults} />
        </>
      ) : null}
    </div>
  );
}
