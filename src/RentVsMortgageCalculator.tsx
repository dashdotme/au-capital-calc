import { useMemo, useState } from 'react';
import type { InvestmentInputs, MonteCarloResults, PropertyInputs, RentInputs } from './types';
import {
  calculateMortgagePayment,
  findBuyCrossoverYear,
  resolveScenarioValue,
  runComparison,
  runScenarioComparison,
  toRealTerms,
} from './utils/calculations';
import { calculateBreakEven } from './utils/breakeven';
import { monteCarloToRealTerms, runMonteCarloSimulation } from './utils/monteCarlo';
import {
  DEFAULT_HORIZON,
  DEFAULT_INVESTMENT,
  DEFAULT_PROPERTY,
  DEFAULT_RENT,
  MONTE_CARLO_ITERATIONS,
} from './defaults';
import AssumptionsPanel from './components/AssumptionsPanel';
import Verdict from './components/Verdict';
import KeyFigures from './components/KeyFigures';
import OutcomeChart from './components/OutcomeChart';
import { FlipList, MoneyBreakdown } from './components/ResultsDetail';
import FocusAnalysis from './components/FocusAnalysis';
import RiskView from './components/RiskView';
import PortfolioComparison from './components/PortfolioComparison';
import { PORTFOLIOS, applyPortfolio } from './portfolios';

type View = 'dashboard' | 'risk';

function Segmented<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line bg-surface p-[3px]">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-md px-3 text-[13px] sm:px-3.5 ${
            value === option.value ? 'bg-line font-semibold text-ink' : 'text-ink-2 hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function RentVsMortgageCalculator() {
  const [propertyInputs, setPropertyInputs] = useState<PropertyInputs>(DEFAULT_PROPERTY);
  const [rentInputs, setRentInputs] = useState<RentInputs>(DEFAULT_RENT);
  const [investmentInputs, setInvestmentInputs] = useState<InvestmentInputs>(DEFAULT_INVESTMENT);
  const [timeHorizon, setTimeHorizon] = useState(DEFAULT_HORIZON);
  const [scenarioMode, setScenarioMode] = useState(true);
  const [realTerms, setRealTerms] = useState(false);
  const [focusMetric, setFocusMetric] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [monteCarloRun, setMonteCarloRun] = useState<{ results: MonteCarloResults; inputsKey: string } | null>(null);
  const [monteCarloRunning, setMonteCarloRunning] = useState(false);

  const inflationRate = investmentInputs.inflationRate;
  const inputsKey = JSON.stringify([propertyInputs, rentInputs, investmentInputs, timeHorizon]);
  const monteCarloStale = monteCarloRun !== null && monteCarloRun.inputsKey !== inputsKey;

  const nominalBaseline = useMemo(
    () => runComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon),
    [propertyInputs, rentInputs, investmentInputs, timeHorizon]
  );
  const nominalScenarios = useMemo(
    () => (scenarioMode ? runScenarioComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon) : null),
    [scenarioMode, propertyInputs, rentInputs, investmentInputs, timeHorizon]
  );
  const breakEvenResults = useMemo(
    () => calculateBreakEven(propertyInputs, rentInputs, investmentInputs, timeHorizon),
    [propertyInputs, rentInputs, investmentInputs, timeHorizon]
  );

  const baseline = realTerms ? toRealTerms(nominalBaseline, inflationRate) : nominalBaseline;
  const scenarios = nominalScenarios && realTerms
    ? {
        pessimistic: toRealTerms(nominalScenarios.pessimistic, inflationRate),
        baseline: toRealTerms(nominalScenarios.baseline, inflationRate),
        optimistic: toRealTerms(nominalScenarios.optimistic, inflationRate),
      }
    : nominalScenarios;
  const final = baseline[baseline.length - 1];
  const crossoverYear = findBuyCrossoverYear(nominalBaseline);
  const monteCarloResults = monteCarloRun
    ? realTerms
      ? monteCarloToRealTerms(monteCarloRun.results, inflationRate, timeHorizon)
      : monteCarloRun.results
    : null;

  const runMonteCarlo = () => {
    setMonteCarloRunning(true);
    // Let the "running" state paint before the heavy synchronous work
    setTimeout(() => {
      try {
        const results = runMonteCarloSimulation(
          propertyInputs,
          rentInputs,
          investmentInputs,
          timeHorizon,
          MONTE_CARLO_ITERATIONS
        );
        setMonteCarloRun({ results, inputsKey });
      } finally {
        setMonteCarloRunning(false);
      }
    }, 30);
  };

  const openRisk = () => {
    setView('risk');
    window.scrollTo({ top: 0 });
    if (!monteCarloRun || monteCarloStale) runMonteCarlo();
  };

  const resetInputs = () => {
    setPropertyInputs(DEFAULT_PROPERTY);
    setRentInputs(DEFAULT_RENT);
    setInvestmentInputs(DEFAULT_INVESTMENT);
    setTimeHorizon(DEFAULT_HORIZON);
    setFocusMetric(null);
  };

  const openFocus = (metric: string | null) => {
    setFocusMetric(metric);
    if (metric) {
      setView('dashboard');
      requestAnimationFrame(() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const monthlyRepayment = calculateMortgagePayment(
    propertyInputs.propertyPrice - propertyInputs.deposit + (propertyInputs.lmi ?? 0),
    resolveScenarioValue(propertyInputs.interestRate, 'baseline'),
    propertyInputs.loanTerm
  );
  const buyWins = final.rentNetPositionAfterTax < final.mortgageNetPositionAfterSale;

  return (
    <div className="min-h-screen bg-ground pb-24 text-ink lg:pb-0">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            {view === 'risk' && (
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="min-h-9 rounded-lg border border-line px-3 text-[13px] text-ink-2 hover:text-ink"
              >
                ← Dashboard
              </button>
            )}
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-bold tracking-tight">{view === 'risk' ? 'Risk' : 'Rent or Buy'}</span>
              <span className="hidden text-[13px] text-ink-2 sm:inline">
                {view === 'risk'
                  ? `${MONTE_CARLO_ITERATIONS.toLocaleString('en-AU')} simulated futures · baseline assumptions`
                  : 'Australian net worth comparison'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {view === 'dashboard' ? (
              <Segmented
                label="Scenario mode"
                value={scenarioMode}
                onChange={setScenarioMode}
                options={[{ value: false, label: 'Single' }, { value: true, label: '3 scenarios' }]}
              />
            ) : (
              <button
                type="button"
                onClick={runMonteCarlo}
                disabled={monteCarloRunning}
                className="min-h-9 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-semibold disabled:opacity-50"
              >
                {monteCarloRunning ? 'Running…' : 'Re-run'}
              </button>
            )}
            <Segmented
              label="Dollar basis"
              value={realTerms}
              onChange={setRealTerms}
              options={[{ value: false, label: 'Future $' }, { value: true, label: "Today's $" }]}
            />
          </div>
        </div>
      </header>

      {view === 'risk' ? (
        <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
          <RiskView
            results={monteCarloResults}
            running={monteCarloRunning}
            stale={monteCarloStale}
            timeHorizon={timeHorizon}
            realTerms={realTerms}
            onRerun={runMonteCarlo}
          />
        </main>
      ) : (
        <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(340px,390px)_minmax(0,1fr)]">
          <div className="order-2 lg:sticky lg:top-6 lg:order-1 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:rounded-xl">
            <AssumptionsPanel
              propertyInputs={propertyInputs}
              rentInputs={rentInputs}
              investmentInputs={investmentInputs}
              timeHorizon={timeHorizon}
              onPropertyChange={setPropertyInputs}
              onRentChange={setRentInputs}
              onInvestmentChange={setInvestmentInputs}
              onTimeHorizonChange={setTimeHorizon}
              onReset={resetInputs}
              scenarioMode={scenarioMode}
              focusMetric={focusMetric}
              onFocusMetric={openFocus}
              monthlyRepayment={monthlyRepayment}
            />
          </div>

          <main className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
            <Verdict
              final={final}
              timeHorizon={timeHorizon}
              crossoverYear={crossoverYear}
              breakEvens={breakEvenResults.results}
              realTerms={realTerms}
            />
            <KeyFigures
              baseline={baseline}
              scenarioResults={scenarios}
              crossoverYear={crossoverYear}
              timeHorizon={timeHorizon}
              monteCarloBuyProbability={monteCarloRun && !monteCarloStale ? monteCarloRun.results.buyBetterProbability : null}
              onOpenRisk={openRisk}
            />
            {focusMetric && (
              <div id="explore" className="scroll-mt-6">
                <FocusAnalysis
                  key={focusMetric}
                  metricKey={focusMetric}
                  propertyInputs={propertyInputs}
                  rentInputs={rentInputs}
                  investmentInputs={investmentInputs}
                  timeHorizon={timeHorizon}
                  onClose={() => setFocusMetric(null)}
                />
              </div>
            )}
            <OutcomeChart baseline={baseline} scenarioResults={scenarios} crossoverYear={crossoverYear} />
            <PortfolioComparison
              propertyInputs={propertyInputs}
              rentInputs={rentInputs}
              investmentInputs={investmentInputs}
              timeHorizon={timeHorizon}
              onSelect={(id) => {
                const preset = PORTFOLIOS.find((x) => x.id === id);
                if (preset) setInvestmentInputs(applyPortfolio(investmentInputs, preset));
              }}
            />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <MoneyBreakdown final={final} timeHorizon={timeHorizon} />
              <FlipList breakEvens={breakEvenResults.results} buyWins={buyWins} onExplore={openFocus} />
            </div>
            <p className="m-0 max-w-3xl text-xs leading-relaxed text-muted">
              Both households start with the same savings and spend the same each month. Whichever option is cheaper that
              month invests the difference. Figures are estimates, not financial advice.
            </p>
          </main>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 border-t border-line bg-ground/95 px-4 pt-3 pb-5 backdrop-blur lg:hidden">
          <a
            href="#assumptions"
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-ink text-[15px] font-semibold text-ground no-underline"
          >
            Edit assumptions
          </a>
          <button
            type="button"
            onClick={openRisk}
            className="min-h-12 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold"
          >
            Risk
          </button>
        </div>
      )}
    </div>
  );
}
