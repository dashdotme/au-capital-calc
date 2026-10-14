import { useState } from 'react';
import type { YearlySnapshot, ScenarioResults, BreakEvenResults } from '../types';

interface ResultsSummaryProps {
  timeHorizon: number;
  finalResult?: YearlySnapshot;
  advantageBeforeTax?: number;
  advantageAfterTax?: number;
  scenarioResults?: ScenarioResults;
  breakEvenResults?: BreakEvenResults;
  /** Baseline year from which buying stays ahead, or null if it never does */
  crossoverYear?: number | null;
}

const formatCurrency = (value: number) =>
  `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

function CrossoverNote({ crossoverYear, timeHorizon }: { crossoverYear?: number | null; timeHorizon: number }) {
  if (crossoverYear === undefined) return null;
  return (
    <p className="text-sm mt-2 text-text-secondary">
      {crossoverYear === null
        ? `Baseline: buying never pulls ahead of renting within ${timeHorizon} years.`
        : `Baseline: buying pulls ahead after ${crossoverYear} year${crossoverYear === 1 ? '' : 's'} and stays ahead. Selling earlier than that favours renting.`}
    </p>
  );
}

function BreakEvenPanel({ breakEvenResults }: { breakEvenResults: BreakEvenResults }) {
  const [expanded, setExpanded] = useState(false);

  const formatMetric = (metric: string, value: number) =>
    metric === 'Monthly Rent' ? formatCurrency(value) : `${value.toFixed(2)}%`;

  return (
    <div className="mb-6 p-6 rounded-lg shadow-xl bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-xl font-semibold text-accent">Break-Even Analysis</h3>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-accent transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {expanded && (
        <div className="mt-4 overflow-x-auto">
          <p className="text-sm text-text-secondary mb-4">
            What value of each parameter, with everything else at baseline, would make buying and
            renting equally attractive after {breakEvenResults.timeHorizon} years?
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-4 text-text-secondary">Metric</th>
                <th className="text-right py-2 px-4 text-text-secondary">Current</th>
                <th className="text-right py-2 px-4 text-text-secondary">Break-Even</th>
                <th className="text-left py-2 px-4 text-text-secondary">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {breakEvenResults.results.map((result) => (
                <tr key={result.metric} className="border-b border-border/50">
                  <td className="py-2 px-4 text-text-primary font-semibold">{result.metric}</td>
                  <td className="text-right py-2 px-4 text-text-primary">
                    {formatMetric(result.metric, result.currentValue)}
                  </td>
                  <td className="text-right py-2 px-4 text-accent font-semibold">
                    {result.breakEvenValue !== null ? formatMetric(result.metric, result.breakEvenValue) : 'N/A'}
                  </td>
                  <td className="py-2 px-4 text-text-secondary text-xs">{result.interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Line({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <p className="text-sm text-text-secondary">
      {label}:{' '}
      <span className={`font-semibold ${positive ? 'text-green-400' : 'text-text-primary'}`}>
        {positive ? '+' : ''}
        {formatCurrency(value)}
      </span>
    </p>
  );
}

export default function ResultsSummary({
  timeHorizon,
  finalResult,
  advantageBeforeTax,
  advantageAfterTax,
  scenarioResults,
  breakEvenResults,
  crossoverYear,
}: ResultsSummaryProps) {
  // If we have scenario results, display three scenarios
  if (scenarioResults) {
    const scenarios = [
      { name: 'Pessimistic', results: scenarioResults.pessimistic, color: 'border-red-500' },
      { name: 'Baseline', results: scenarioResults.baseline, color: 'border-blue-500' },
      { name: 'Optimistic', results: scenarioResults.optimistic, color: 'border-green-500' },
    ];

    return (
      <>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2 text-accent">
            After {timeHorizon} Years - Scenario Comparison
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            Net worth of each household after selling everything and paying exit costs and taxes.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {scenarios.map(({ name, results, color }) => {
              const final = results[results.length - 1];
              const advantage = final.rentNetPositionAfterTax - final.mortgageNetPositionAfterSale;

              return (
                <div key={name} className={`p-6 rounded-lg shadow-xl bg-card border-l-4 ${color}`}>
                  <h3 className="text-xl font-semibold mb-4 text-accent">{name}</h3>

                  <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2 text-text-primary">Buying (Mortgage)</h4>
                    <p className="text-xs text-text-secondary">
                      Property Value: {formatCurrency(final.mortgagePropertyValue)}
                    </p>
                    {final.mortgageInvestmentValue > 0 && (
                      <p className="text-xs text-text-secondary">
                        Investments: {formatCurrency(final.mortgageInvestmentValue)}
                      </p>
                    )}
                    <p className="text-sm font-bold mt-1 text-text-primary">
                      Net (after sale): {formatCurrency(final.mortgageNetPositionAfterSale)}
                    </p>
                  </div>

                  <div className="mb-4 pb-4 border-b border-border">
                    <h4 className="font-semibold text-sm mb-2 text-text-primary">Renting + Investing</h4>
                    <p className="text-xs text-text-secondary">
                      Investment: {formatCurrency(final.rentInvestmentValue)}
                    </p>
                    <p className="text-sm font-bold mt-1 text-text-primary">
                      Net (after CGT): {formatCurrency(final.rentNetPositionAfterTax)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-text-secondary mb-1">Winner:</p>
                    <p className="text-lg font-bold text-accent">
                      {advantage > 0
                        ? `Renting +${formatCurrency(Math.abs(advantage))}`
                        : `Buying +${formatCurrency(Math.abs(advantage))}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <CrossoverNote crossoverYear={crossoverYear} timeHorizon={timeHorizon} />
        </div>
        {breakEvenResults && <BreakEvenPanel breakEvenResults={breakEvenResults} />}
      </>
    );
  }

  // Original single-scenario view
  if (!finalResult) return null;

  return (
    <>
      <div className="p-6 rounded-lg shadow-xl mb-6 bg-card">
        <h2 className="text-2xl font-semibold mb-6 text-accent">
          After {timeHorizon} Years
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="pr-6 md:border-r border-border">
            <h3 className="font-semibold text-lg mb-4 text-accent">
              Buying (Mortgage)
            </h3>
            <div className="space-y-2">
              <Line label="Property Value" value={finalResult.mortgagePropertyValue} />
              <Line label="Loan Balance" value={finalResult.mortgageLoanBalance} />
              <Line label="Home Equity" value={finalResult.mortgageEquity} />
              {finalResult.mortgageInvestmentValue > 0 && (
                <Line label="Investments (surplus cash flow)" value={finalResult.mortgageInvestmentValue} />
              )}
              <Line label="Total Interest" value={finalResult.mortgageTotalInterest} />
              <Line label="Maintenance" value={finalResult.mortgageMaintenance} />
              <Line label="Council Rates" value={finalResult.mortgageRates} />
              <Line label="Insurance" value={finalResult.mortgageInsurance} />
            </div>
            <p className="text-lg font-bold mt-4 text-text-primary">
              Net worth (holding): {formatCurrency(finalResult.mortgageNetPosition)}
            </p>
            <p className="text-xl font-bold mt-2 text-accent">
              Net worth (after sale): {formatCurrency(finalResult.mortgageNetPositionAfterSale)}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4 text-accent">
              Renting + Investing
            </h3>
            <div className="space-y-2">
              <Line label="Investment Value" value={finalResult.rentInvestmentValue} />
              <Line label="Total Rent Paid" value={finalResult.rentTotalPaid} />
              <Line label="Moving Costs" value={finalResult.rentMovingCosts} />
              <Line label="Insurance" value={finalResult.rentInsurance} />
              {finalResult.rentDividends > 0 && (
                <Line label="Dividends (after tax)" value={finalResult.rentDividends} positive />
              )}
              {finalResult.rentFrankingCredits > 0 && (
                <Line label="Franking Credits" value={finalResult.rentFrankingCredits} positive />
              )}
            </div>
            <p className="text-lg font-bold mt-4 text-text-primary">
              Net worth (holding): {formatCurrency(finalResult.rentNetPosition)}
            </p>
            <p className="text-xl font-bold mt-2 text-accent">
              Net worth (after CGT): {formatCurrency(finalResult.rentNetPositionAfterTax)}
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <h3 className="font-semibold mb-3 text-text-primary">
            Comparison (After All Exit Costs & Taxes)
          </h3>
          <p className="text-2xl font-bold text-accent">
            {(advantageAfterTax ?? 0) > 0
              ? `Renting + Investing is ahead by ${formatCurrency(Math.abs(advantageAfterTax ?? 0))}`
              : `Buying is ahead by ${formatCurrency(Math.abs(advantageAfterTax ?? 0))}`}
          </p>
          <p className="text-sm mt-2 text-text-secondary">
            Before tax & exit costs:{' '}
            {(advantageBeforeTax ?? 0) > 0
              ? `Renting ahead by ${formatCurrency(Math.abs(advantageBeforeTax ?? 0))}`
              : `Buying ahead by ${formatCurrency(Math.abs(advantageBeforeTax ?? 0))}`}
          </p>
          <CrossoverNote crossoverYear={crossoverYear} timeHorizon={timeHorizon} />
          <p className="text-xs mt-4 text-text-secondary opacity-70">
            Both households start with the same savings and spend the same amount each month on
            housing plus investing: whichever option is cheaper in a given month invests the difference.
          </p>
        </div>
      </div>
      {breakEvenResults && <BreakEvenPanel breakEvenResults={breakEvenResults} />}
    </>
  );
}
