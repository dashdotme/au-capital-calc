import type { ReactNode } from 'react';
import type { ScenarioResults, YearlySnapshot } from '../types';
import { formatAdvantage, formatCompactCurrency, formatCurrency, formatPercent } from '../utils/format';

interface KeyFiguresProps {
  baseline: YearlySnapshot[];
  sellYear: number;
  scenarioResults: ScenarioResults | null;
  crossoverYear: number | null;
  timeHorizon: number;
  /** Share of simulations where buying ends ahead; null until a fresh run exists */
  monteCarloBuyProbability: number | null;
  onOpenRisk: () => void;
}

function Tile({ label, value, note }: { label: string; value: ReactNode; note: ReactNode }) {
  return (
    <>
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="font-mono text-[22px]">{value}</span>
      <span className="text-xs leading-snug text-muted">{note}</span>
    </>
  );
}

const tileClass = 'card flex flex-col gap-1.5 px-5 py-4 text-left';

export default function KeyFigures({
  baseline,
  sellYear,
  scenarioResults,
  crossoverYear,
  timeHorizon,
  monteCarloBuyProbability,
  onOpenRisk,
}: KeyFiguresProps) {
  const first = baseline[Math.min(1, baseline.length - 1)];
  const ownMonthly = first.mortgageAnnualCost / 12;
  const rentMonthly = first.rentAnnualCost / 12;
  const gap = Math.abs(ownMonthly - rentMonthly);
  const final = baseline[sellYear];

  const advantages = scenarioResults
    ? [scenarioResults.pessimistic, scenarioResults.baseline, scenarioResults.optimistic].map((s) => {
        const atSale = s[sellYear];
        return atSale.rentNetPositionAfterTax - atSale.mortgageNetPositionAfterSale;
      })
    : null;

  return (
    <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className={tileClass}>
        <Tile
          label="Year 1 housing cost / month"
          value={<>{formatCurrency(ownMonthly)} <span className="text-sm text-muted">vs {formatCurrency(rentMonthly)}</span></>}
          note={`Own vs rent. The ${ownMonthly > rentMonthly ? 'renter' : 'owner'} invests the ${formatCurrency(gap)} gap.`}
        />
      </div>
      <div className={tileClass}>
        <Tile
          label="Buying pulls ahead"
          value={crossoverYear === null ? 'Not yet' : `Year ${crossoverYear}`}
          note={crossoverYear === null
            ? `Buying doesn't stay ahead within ${timeHorizon} years.`
            : 'Minimum holding period for buying to win.'}
        />
      </div>
      <div className={tileClass}>
        {advantages ? (
          <Tile
            label="Across 3 scenarios"
            value={`${advantages.filter((a) => a < 0).length} of 3 buy`}
            note={`${formatAdvantage(Math.min(...advantages))} to ${formatAdvantage(Math.max(...advantages))}.`}
          />
        ) : (
          <Tile
            label="Interest paid"
            value={formatCompactCurrency(final.mortgageTotalInterest)}
            note={`Over ${sellYear} years, after the offset.`}
          />
        )}
      </div>
      <button type="button" onClick={onOpenRisk} className={`${tileClass} cursor-pointer hover:border-line-strong`}>
        {monteCarloBuyProbability === null ? (
          <Tile
            label="Across 5,000 simulated futures"
            value="Run it"
            note={<span className="underline">Simulate market swings →</span>}
          />
        ) : (
          <Tile
            label="Across 5,000 simulated futures"
            value={`${formatPercent(monteCarloBuyProbability)} buy`}
            note={<span className="underline">See the full risk picture →</span>}
          />
        )}
      </button>
    </section>
  );
}
