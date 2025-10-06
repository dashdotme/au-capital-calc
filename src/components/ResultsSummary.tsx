import type { YearlySnapshot, ScenarioResults } from '../types';

interface ResultsSummaryProps {
  timeHorizon: number;
  finalResult?: YearlySnapshot;
  advantageBeforeTax?: number;
  advantageAfterTax?: number;
  scenarioResults?: ScenarioResults;
}

export default function ResultsSummary({
  timeHorizon,
  finalResult,
  advantageBeforeTax,
  advantageAfterTax,
  scenarioResults,
}: ResultsSummaryProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

  // If we have scenario results, display three scenarios
  if (scenarioResults) {
    const pessimisticFinal = scenarioResults.pessimistic[scenarioResults.pessimistic.length - 1];
    const baselineFinal = scenarioResults.baseline[scenarioResults.baseline.length - 1];
    const optimisticFinal = scenarioResults.optimistic[scenarioResults.optimistic.length - 1];

    const scenarios = [
      { name: 'Pessimistic', final: pessimisticFinal, color: 'border-red-500' },
      { name: 'Baseline', final: baselineFinal, color: 'border-blue-500' },
      { name: 'Optimistic', final: optimisticFinal, color: 'border-green-500' },
    ];

    return (
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-6 text-accent">
          After {timeHorizon} Years - Scenario Comparison
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {scenarios.map(({ name, final, color }) => {
            const advantageAfterTax =
              final.rentNetPositionAfterTax - final.mortgageNetPositionAfterSale;

            return (
              <div key={name} className={`p-6 rounded-lg shadow-xl bg-card border-l-4 ${color}`}>
                <h3 className="text-xl font-semibold mb-4 text-accent">{name}</h3>

                <div className="mb-4">
                  <h4 className="font-semibold text-sm mb-2 text-text-primary">Buying (Mortgage)</h4>
                  <p className="text-xs text-text-secondary">
                    Property Value: {formatCurrency(final.mortgagePropertyValue)}
                  </p>
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
                    {advantageAfterTax > 0
                      ? `Renting +${formatCurrency(Math.abs(advantageAfterTax))}`
                      : `Buying +${formatCurrency(Math.abs(advantageAfterTax))}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Original single-scenario view
  if (!finalResult) return null;

  return (
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
            <p className="text-sm text-text-secondary">
              Property Value:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.mortgagePropertyValue)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Equity Built:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.mortgageEquity)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Mortgage Paid:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.mortgageTotalPaid)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Total Interest:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.mortgageTotalInterest)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Maintenance:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.mortgageMaintenance)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Council Rates:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.mortgageRates)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Insurance:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.mortgageInsurance)}
              </span>
            </p>
          </div>
          <p className="text-lg font-bold mt-4 text-text-primary">
            Net (holding): {formatCurrency(finalResult.mortgageNetPosition)}
          </p>
          <p className="text-xl font-bold mt-2 text-accent">
            Net (after sale): {formatCurrency(finalResult.mortgageNetPositionAfterSale)}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-lg mb-4 text-accent">
            Renting + Investing
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              Investment Value:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.rentInvestmentValue)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Total Rent Paid:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.rentTotalPaid)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Moving Costs:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.rentMovingCosts)}
              </span>
            </p>
            <p className="text-sm text-text-secondary">
              Insurance:{' '}
              <span className="font-semibold text-text-primary">
                {formatCurrency(finalResult.rentInsurance)}
              </span>
            </p>
            {finalResult.rentDividends > 0 && (
              <>
                <p className="text-sm text-text-secondary">
                  Dividends Received:{' '}
                  <span className="font-semibold text-green-400">
                    +{formatCurrency(finalResult.rentDividends)}
                  </span>
                </p>
                <p className="text-sm text-text-secondary">
                  Franking Credits:{' '}
                  <span className="font-semibold text-green-400">
                    +{formatCurrency(finalResult.rentFrankingCredits)}
                  </span>
                </p>
              </>
            )}
          </div>
          <p className="text-lg font-bold mt-4 text-text-primary">
            Net (before tax): {formatCurrency(finalResult.rentNetPosition)}
          </p>
          <p className="text-xl font-bold mt-2 text-accent">
            Net (after CGT): {formatCurrency(finalResult.rentNetPositionAfterTax)}
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
        {finalResult.rentFrankingCredits > 0 && (
          <p className="text-sm mt-2 text-text-secondary">
            Stocks benefited from {formatCurrency(finalResult.rentFrankingCredits)} in franking credit refunds
          </p>
        )}
      </div>
    </div>
  );
}
