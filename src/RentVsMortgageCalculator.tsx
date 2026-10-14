import { useState, useMemo } from 'react';
import type { PropertyInputs, RentInputs, InvestmentInputs, MonteCarloResults } from './types';
import {
  calculateMortgagePayment,
  findBuyCrossoverYear,
  runComparison,
  runScenarioComparison,
  isScenarioValue,
  toRealTerms,
} from './utils/calculations';
import { calculateBreakEven } from './utils/breakeven';
import { monteCarloToRealTerms, runMonteCarloSimulation } from './utils/monteCarlo';
import PropertyInputsCard from './components/PropertyInputsCard';
import RentInputsCard from './components/RentInputsCard';
import InvestmentInputsCard from './components/InvestmentInputsCard';
import ResultsSummary from './components/ResultsSummary';
import ComparisonChart from './components/ComparisonChart';
import ScenarioToggle from './components/ScenarioToggle';
import MonteCarloView from './components/MonteCarloView';

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
    lmi: 0,
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
    marginalTaxRate: 39,
    inflationRate: 2.5,
    stockTransactionCost: 0.1,
    dividendYield: 1.5,
    frankingLevel: 0,
    dividendReinvestment: true,
  });

  const [timeHorizon, setTimeHorizon] = useState(30);
  const [scenarioMode, setScenarioMode] = useState(true);
  const [focusMetric, setFocusMetric] = useState<string | null>(null);
  const [realTerms, setRealTerms] = useState(false);
  const [monteCarloRun, setMonteCarloRun] = useState<{ results: MonteCarloResults; inputsKey: string } | null>(null);
  const [monteCarloRunning, setMonteCarloRunning] = useState(false);

  const inputsKey = JSON.stringify([propertyInputs, rentInputs, investmentInputs, timeHorizon]);
  const monteCarloStale = monteCarloRun !== null && monteCarloRun.inputsKey !== inputsKey;
  const inflationRate = investmentInputs.inflationRate;
  const monteCarloResults = monteCarloRun
    ? realTerms
      ? monteCarloToRealTerms(monteCarloRun.results, inflationRate, timeHorizon)
      : monteCarloRun.results
    : null;

  const hasScenarioValues = useMemo(() => {
    return (
      isScenarioValue(propertyInputs.interestRate) ||
      isScenarioValue(rentInputs.rentIncreaseRate) ||
      isScenarioValue(investmentInputs.stockMarketReturn) ||
      isScenarioValue(investmentInputs.propertyGrowthRate)
    );
  }, [propertyInputs.interestRate, rentInputs.rentIncreaseRate, investmentInputs.stockMarketReturn, investmentInputs.propertyGrowthRate]);

  const baselineResults = useMemo(
    () => runComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon),
    [propertyInputs, rentInputs, investmentInputs, timeHorizon]
  );

  const results = useMemo(() => {
    if (scenarioMode && hasScenarioValues) {
      const nominal = runScenarioComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon);
      if (!realTerms) return nominal;
      return {
        pessimistic: toRealTerms(nominal.pessimistic, inflationRate),
        baseline: toRealTerms(nominal.baseline, inflationRate),
        optimistic: toRealTerms(nominal.optimistic, inflationRate),
      };
    }
    return null;
  }, [scenarioMode, hasScenarioValues, propertyInputs, rentInputs, investmentInputs, timeHorizon, realTerms, inflationRate]);

  const singleResults = useMemo(() => {
    if (!scenarioMode || !hasScenarioValues) {
      return realTerms ? toRealTerms(baselineResults, inflationRate) : baselineResults;
    }
    return null;
  }, [scenarioMode, hasScenarioValues, baselineResults, realTerms, inflationRate]);

  const crossoverYear = findBuyCrossoverYear(baselineResults);
  // First full year of ownership: positive means owning costs more than renting
  const monthlyCostGap = baselineResults.length > 1
    ? (baselineResults[1].mortgageAnnualCost - baselineResults[1].rentAnnualCost) / 12
    : 0;

  const breakEvenResults = useMemo(() => {
    return calculateBreakEven(propertyInputs, rentInputs, investmentInputs, timeHorizon);
  }, [propertyInputs, rentInputs, investmentInputs, timeHorizon]);

  const handleRunMonteCarlo = async () => {
    setMonteCarloRunning(true);
    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      try {
        const results = runMonteCarloSimulation(
          propertyInputs,
          rentInputs,
          investmentInputs,
          timeHorizon,
          5000
        );
        setMonteCarloRun({ results, inputsKey });
      } finally {
        setMonteCarloRunning(false);
      }
    }, 100);
  };

  const loanAmount = propertyInputs.propertyPrice - propertyInputs.deposit + (propertyInputs.lmi ?? 0);
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
      <label className="flex items-center gap-3 mb-6 text-sm text-text-secondary cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={realTerms}
          onChange={(e) => setRealTerms(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        Show results in today's dollars (adjusted for {inflationRate}% inflation)
      </label>
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
          monthlyCostGap={monthlyCostGap}
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
            breakEvenResults={breakEvenResults}
            crossoverYear={crossoverYear}
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
            breakEvenResults={breakEvenResults}
            crossoverYear={crossoverYear}
          />
          <ComparisonChart results={singleResults} />
        </>
      ) : null}

      {/* Monte Carlo Section */}
      <div className="p-6 rounded-lg shadow-xl bg-card border-l-4 border-purple-500 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-accent">Monte Carlo Simulation</h2>
        <p className="text-sm text-text-secondary mb-4">
          Run thousands of simulated economic paths to understand the probability distribution of outcomes.
          Each path draws its own long-run averages plus correlated year-to-year swings in interest rates,
          stock returns, property growth and rent increases, so it captures sequence-of-returns risk and
          variable mortgage rates.
        </p>
        {!monteCarloResults ? (
          <button
            onClick={handleRunMonteCarlo}
            disabled={monteCarloRunning}
            className="px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {monteCarloRunning ? 'Running 5,000 Simulations...' : 'Run Monte Carlo Analysis'}
          </button>
        ) : (
          <div>
            <button
              onClick={handleRunMonteCarlo}
              disabled={monteCarloRunning}
              className="px-6 py-3 bg-accent/70 text-white font-semibold rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {monteCarloRunning ? 'Running...' : 'Re-run Analysis'}
            </button>
            <button
              onClick={() => setMonteCarloRun(null)}
              className="ml-4 px-6 py-3 bg-card border border-border text-text-primary font-semibold rounded-lg hover:bg-card/80 transition-colors"
            >
              Clear Results
            </button>
            {monteCarloStale && (
              <p className="text-sm text-amber-400">
                Inputs have changed since this simulation ran. Re-run to update the results.
              </p>
            )}
          </div>
        )}
      </div>

      {monteCarloResults && (
        <MonteCarloView results={monteCarloResults} timeHorizon={timeHorizon} />
      )}
    </div>
  );
}
