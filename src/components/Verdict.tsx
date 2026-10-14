import type { BreakEvenResult, YearlySnapshot } from '../types';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { flipDistance, formatMetricValue } from '../utils/flip';

interface VerdictProps {
  final: YearlySnapshot;
  sellYear: number;
  timeHorizon: number;
  onSellYearChange: (year: number) => void;
  /** How much the user's latest edits moved the advantage (positive = toward renting) */
  changeFlash: { delta: number; at: number } | null;
  crossoverYear: number | null;
  breakEvens: BreakEvenResult[];
  realTerms: boolean;
}

const PHRASES: Record<string, string> = {
  interestRate: 'a mortgage rate of',
  maintenanceRate: 'maintenance of',
  monthlyRent: 'rent of',
  rentIncreaseRate: 'rent growth of',
  stockMarketReturn: 'share returns of',
  propertyGrowthRate: 'property growth of',
  dividendYield: 'a dividend yield of',
};

export default function Verdict({
  final,
  sellYear,
  timeHorizon,
  onSellYearChange,
  changeFlash,
  crossoverYear,
  breakEvens,
  realTerms,
}: VerdictProps) {
  const buy = final.mortgageNetPositionAfterSale;
  const rent = final.rentNetPositionAfterTax;
  const advantage = rent - buy;
  const buyWins = advantage < 0;
  const scale = Math.max(Math.abs(buy), Math.abs(rent), 1);

  const nearest = breakEvens
    .filter((b) => b.breakEvenValue !== null)
    .sort((a, b) => flipDistance(a) - flipDistance(b))
    .slice(0, 2);
  const closeCall = nearest.length > 0 && flipDistance(nearest[0]) < 0.15;
  const tippers = nearest
    .map((b) => `${PHRASES[b.metricKey] ?? b.metric.toLowerCase()} ${formatMetricValue(b, b.breakEvenValue!)}`)
    .join(' or ');

  let timing: string;
  if (crossoverYear !== null && sellYear >= crossoverYear) {
    timing = `Buying takes the lead in year ${crossoverYear} and keeps it.`;
  } else if (crossoverYear !== null) {
    timing = `Buying only takes the lead in year ${crossoverYear}, so selling sooner favours renting.`;
  } else if (buyWins) {
    timing = 'Buying is ahead at this point, but the lead changes hands along the way.';
  } else {
    timing = `Renting and investing is ahead at the ${sellYear}-year mark.`;
  }
  const sensitivity = nearest.length === 0
    ? 'No single assumption on its own would change the answer.'
    : closeCall
      ? `It's a close call: ${tippers} would tip it.`
      : `It would take ${tippers} to change the answer.`;

  const rows = [
    { label: 'Buy · net worth after selling', value: buy, color: 'bg-buy' },
    { label: 'Rent + invest · net worth after CGT', value: rent, color: 'bg-rent' },
  ];

  return (
    <section aria-label="Verdict" className="card flex flex-col gap-6 px-6 py-7 sm:px-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">If you sell after</span>
            <input
              type="range"
              min={1}
              max={timeHorizon}
              value={sellYear}
              onChange={(e) => onSellYearChange(Number(e.target.value))}
              className="w-40 accent-[var(--color-ink)] sm:w-56"
              aria-valuetext={`${sellYear} years`}
            />
            <span className="font-mono text-sm text-ink">{sellYear} {sellYear === 1 ? 'year' : 'years'}</span>
          </label>
          <span className="eyebrow">Baseline{realTerms ? " · today's dollars" : ''}</span>
        </div>
        <h1 className="m-0 text-3xl leading-tight font-bold tracking-tight sm:text-[40px]">
          {buyWins ? 'Buying' : 'Renting and investing'} comes out ahead by{' '}
          <span className="font-mono font-medium whitespace-nowrap">{formatCurrency(Math.abs(advantage))}</span>
        </h1>
        <p className="m-0 max-w-2xl text-base leading-relaxed text-ink-2">
          {timing} {sensitivity}
        </p>
        <div aria-live="polite" className="min-h-7">
          {changeFlash && Math.abs(changeFlash.delta) >= 500 && (
            <span
              key={changeFlash.at}
              className="change-flash inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised px-3 py-1 text-[13px]"
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${changeFlash.delta > 0 ? 'bg-rent' : 'bg-buy'}`} />
              Your change moved it{' '}
              <span className="font-mono">{formatCompactCurrency(Math.abs(changeFlash.delta))}</span> toward{' '}
              {changeFlash.delta > 0 ? 'renting' : 'buying'}
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${row.color}`} />
              {row.label}
            </div>
            <span className="font-mono text-[28px] font-medium">
              <span className="sm:hidden">{formatCompactCurrency(row.value)}</span>
              <span className="hidden sm:inline">{formatCurrency(row.value)}</span>
            </span>
            <div className="h-2 rounded-full bg-line" aria-hidden>
              <div className={`h-2 rounded-full ${row.color}`} style={{ width: `${Math.max(0, (row.value / scale) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
