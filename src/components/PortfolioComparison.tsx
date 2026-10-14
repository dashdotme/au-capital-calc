import { useMemo } from 'react';
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { finalAdvantage, runComparison } from '../utils/calculations';
import { formatAdvantage } from '../utils/format';
import { PORTFOLIOS, applyPortfolio } from '../portfolios';

interface PortfolioComparisonProps {
  propertyInputs: PropertyInputs;
  rentInputs: RentInputs;
  investmentInputs: InvestmentInputs;
  timeHorizon: number;
  onSelect: (id: string) => void;
}

/** Re-runs the baseline with each portfolio preset so markets can be compared side by side. */
export default function PortfolioComparison({
  propertyInputs,
  rentInputs,
  investmentInputs,
  timeHorizon,
  onSelect,
}: PortfolioComparisonProps) {
  const rows = useMemo(
    () =>
      PORTFOLIOS.map((preset) => ({
        preset,
        advantage: finalAdvantage(
          runComparison(propertyInputs, rentInputs, applyPortfolio(investmentInputs, preset), timeHorizon)
        ),
      })),
    [propertyInputs, rentInputs, investmentInputs, timeHorizon]
  );
  const scale = Math.max(...rows.map((r) => Math.abs(r.advantage)), 1);

  return (
    <section aria-label="Compare investment markets" className="card flex flex-col gap-4 px-5 py-6 sm:px-7">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">What if you invested somewhere else?</h2>
        <p className="m-0 text-[13px] text-ink-2">
          Baseline result after {timeHorizon} years with each portfolio, using its own return, dividends, franking and
          fees. Both households invest their surplus in the same portfolio.
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map(({ preset, advantage }) => {
          const selected = investmentInputs.portfolio === preset.id;
          const width = (Math.abs(advantage) / scale) * 50;
          return (
            <li
              key={preset.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-line py-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] ${
                selected ? 'bg-raised/40' : ''
              }`}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {preset.name}
                  {selected && <span className="ml-2 text-xs font-normal text-ink-2">· in use</span>}
                </span>
                <span className="font-mono text-xs text-muted">
                  {preset.example} · {preset.returns.baseline}% return · {preset.dividendYield}% yield
                  {preset.frankingLevel > 0 ? `, ${preset.frankingLevel}% franked` : ''} · {preset.managementFee}% fee
                </span>
              </div>
              <div className="order-3 col-span-2 flex items-center gap-3 sm:order-none sm:col-span-1">
                <div className="relative h-2 flex-1 rounded-full bg-line" aria-hidden>
                  <div className="absolute inset-y-0 left-1/2 w-px bg-ink/40" />
                  <div
                    className={`absolute inset-y-0 rounded-full ${advantage > 0 ? 'bg-rent' : 'bg-buy'}`}
                    style={advantage > 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
                  />
                </div>
                <span className="w-[108px] shrink-0 text-right font-mono text-sm">{formatAdvantage(advantage)}</span>
              </div>
              <button
                type="button"
                onClick={() => onSelect(preset.id)}
                disabled={selected}
                className="min-h-9 rounded-md border border-line px-3 text-[13px] text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                {selected ? 'Using' : 'Use'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-xs leading-relaxed text-muted">
        Expected returns are long-run assumptions, not forecasts. Riskier portfolios also have wider outcomes; see Risk.
      </p>
    </section>
  );
}
