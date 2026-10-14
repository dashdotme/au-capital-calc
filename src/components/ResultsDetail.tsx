import type { BreakEvenResult, YearlySnapshot } from '../types';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { flipDistance, formatMetricValue } from '../utils/flip';

function Swatch({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-sm ${className}`} />;
}

export function MoneyBreakdown({ final, timeHorizon }: { final: YearlySnapshot; timeHorizon: number }) {
  const offsetCash = final.mortgageNetPosition - final.mortgageEquity - final.mortgageInvestmentValue;
  const buyExit = final.mortgageNetPositionAfterSale - final.mortgageNetPosition;
  const rentExit = final.rentNetPositionAfterTax - final.rentNetPosition;
  const dash = <span className="text-muted">–</span>;

  const rows: { label: string; buy: number | null; rent: number | null }[] = [
    { label: 'Home value', buy: final.mortgagePropertyValue, rent: null },
    ...(final.mortgageLoanBalance > 1 ? [{ label: 'Loan still owed', buy: -final.mortgageLoanBalance, rent: null }] : []),
    { label: 'Shares', buy: final.mortgageInvestmentValue, rent: final.rentInvestmentValue },
    ...(Math.abs(offsetCash) > 1 ? [{ label: 'Offset cash', buy: offsetCash, rent: null }] : []),
    { label: 'Selling costs and tax', buy: buyExit, rent: rentExit },
  ];

  const ownerCosts = final.mortgageMaintenance + final.mortgageRates + final.mortgageInsurance;

  return (
    <section aria-label="Where the money ends up" className="card flex min-w-0 flex-col gap-3.5 px-5 py-6 sm:px-7">
      <h2 className="m-0 text-lg font-semibold">Where the money ends up</h2>
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-right text-xs text-ink-2">
              <th scope="col" className="pb-2.5 text-left font-medium">{timeHorizon} years</th>
              <th scope="col" className="pb-2.5 font-medium"><span className="inline-flex items-center gap-1.5"><Swatch className="bg-buy" />Buy</span></th>
              <th scope="col" className="pb-2.5 pl-4 font-medium"><span className="inline-flex items-center gap-1.5"><Swatch className="bg-rent" />Rent</span></th>
            </tr>
          </thead>
          <tbody className="text-right font-mono">
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <th scope="row" className="py-2.5 text-left font-sans font-normal text-ink-2">{row.label}</th>
                <td className="py-2.5">{row.buy === null ? dash : formatCurrency(row.buy)}</td>
                <td className="py-2.5 pl-4">{row.rent === null ? dash : formatCurrency(row.rent)}</td>
              </tr>
            ))}
            <tr className="border-t border-line-strong font-medium">
              <th scope="row" className="py-3 text-left font-sans font-semibold">Net worth</th>
              <td className="py-3">{formatCurrency(final.mortgageNetPositionAfterSale)}</td>
              <td className="py-3 pl-4">{formatCurrency(final.rentNetPositionAfterTax)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="m-0 text-xs leading-relaxed text-muted">
        Along the way the buyer paid {formatCompactCurrency(final.mortgageTotalInterest)} interest and{' '}
        {formatCompactCurrency(ownerCosts)} maintenance, rates and insurance. The renter paid{' '}
        {formatCompactCurrency(final.rentTotalPaid)} rent
        {final.rentMovingCosts > 0 ? ` and ${formatCompactCurrency(final.rentMovingCosts)} moving` : ''}.
      </p>
    </section>
  );
}

export function FlipList({
  breakEvens,
  buyWins,
  onExplore,
}: {
  breakEvens: BreakEvenResult[];
  buyWins: boolean;
  onExplore: (metricKey: string) => void;
}) {
  const flippable = breakEvens.filter((b) => b.breakEvenValue !== null).sort((a, b) => flipDistance(a) - flipDistance(b));
  const fixed = breakEvens.filter((b) => b.breakEvenValue === null);

  return (
    <section aria-label="What would flip it" className="card flex min-w-0 flex-col gap-3.5 px-5 py-6 sm:px-7">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">What would flip it to {buyWins ? 'renting' : 'buying'}</h2>
        <p className="m-0 text-[13px] text-ink-2">Each value on its own, everything else at baseline. Closest first.</p>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {flippable.map((b) => {
          const pct = Math.round(flipDistance(b) * 100);
          return (
            <li key={b.metricKey} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 border-t border-line py-2.5">
              <button
                type="button"
                onClick={() => onExplore(b.metricKey)}
                className="flex min-w-0 flex-col items-start gap-0.5 text-left hover:text-ink"
                title={`Explore ${b.metric.toLowerCase()}`}
              >
                <span className="text-sm underline decoration-line-strong underline-offset-4">{b.metric}</span>
                <span className="font-mono text-xs text-ink-2">
                  {formatMetricValue(b, b.currentValue)} → {formatMetricValue(b, b.breakEvenValue!)}
                </span>
              </button>
              <div className="flex flex-col items-end gap-1">
                <div className="h-1.5 w-full rounded-full bg-line" aria-hidden>
                  <div className="h-1.5 rounded-full bg-ink-2" style={{ width: `${Math.max(4, Math.min(100, pct * 2))}%` }} />
                </div>
                <span className="text-[11px] text-muted">{pct}% change</span>
              </div>
            </li>
          );
        })}
        {flippable.length === 0 && (
          <li className="border-t border-line py-3 text-sm text-ink-2">No single assumption flips the result within a plausible range.</li>
        )}
      </ul>
      {fixed.length > 0 && (
        <p className="m-0 text-xs leading-relaxed text-muted">
          Can't flip it alone: {fixed.map((b) => b.metric.toLowerCase()).join(', ')}.
        </p>
      )}
    </section>
  );
}
