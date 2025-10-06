import type { YearlySnapshot } from '../types';

interface ResultsSummaryProps {
  timeHorizon: number;
  finalResult: YearlySnapshot;
  advantageBeforeTax: number;
  advantageAfterTax: number;
}

export default function ResultsSummary({
  timeHorizon,
  finalResult,
  advantageBeforeTax,
  advantageAfterTax,
}: ResultsSummaryProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

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
          {advantageAfterTax > 0
            ? `Renting + Investing is ahead by ${formatCurrency(Math.abs(advantageAfterTax))}`
            : `Buying is ahead by ${formatCurrency(Math.abs(advantageAfterTax))}`}
        </p>
        <p className="text-sm mt-2 text-text-secondary">
          Before tax & exit costs:{' '}
          {advantageBeforeTax > 0
            ? `Renting ahead by ${formatCurrency(Math.abs(advantageBeforeTax))}`
            : `Buying ahead by ${formatCurrency(Math.abs(advantageBeforeTax))}`}
        </p>
      </div>
    </div>
  );
}
