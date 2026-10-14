import type { BreakEvenResult } from '../types';
import { flipDistance, formatMetricValue } from '../utils/flip';

export default function FlipList({
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
