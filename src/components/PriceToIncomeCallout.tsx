import type { PriceToIncome } from '../utils/priceToIncome';
import { RECORD_MULTIPLE } from '../utils/priceToIncome';

interface PriceToIncomeCalloutProps {
  check: PriceToIncome;
  sellYear: number;
  propertyGrowth: number;
  onMatchIncomes: () => void;
}

/** Shown when the growth assumption pushes prices far beyond local incomes. */
export default function PriceToIncomeCallout({ check, sellYear, propertyGrowth, onMatchIncomes }: PriceToIncomeCalloutProps) {
  if (!check.stretched) return null;
  return (
    <aside
      aria-label="Price-to-income check"
      className="flex flex-col gap-3 rounded-2xl border border-line-strong bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="mt-0.5 shrink-0 text-ink-2">
          <path d="M10 2.5l8 14.5H2L10 2.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M10 8v4.2M10 14.6v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <p className="m-0 text-[15px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">Reality check:</span> at {propertyGrowth}% a year, homes in {check.area} would cost{' '}
          <span className="font-mono text-ink">{check.atSale.toFixed(1)}×</span> the median household income by year {sellYear}, up from{' '}
          <span className="font-mono">{check.now.toFixed(1)}×</span> today. The most any Australian capital has reached is about{' '}
          {RECORD_MULTIPLE}×, so this assumes homes keep getting less affordable, which usually takes falling rates or looser lending.
        </p>
      </div>
      <button
        type="button"
        onClick={onMatchIncomes}
        className="min-h-11 shrink-0 rounded-full border border-line-strong px-4 text-sm font-medium hover:border-ink-2"
      >
        Grow with incomes ({check.incomeGrowth}%)
      </button>
    </aside>
  );
}
