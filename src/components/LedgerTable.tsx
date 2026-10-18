import type { PropertyInputs, YearlySnapshot } from '../types';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { upfrontCostsOf } from '../utils/calculations';

interface LedgerTableProps {
  final: YearlySnapshot;
  property: PropertyInputs;
  sellYear: number;
  horizon: number;
  realTerms: boolean;
  /** Converts year-0 input amounts (purchase costs) into the displayed dollar basis */
  deflator: number;
  onSellYearChange: (year: number) => void;
  changeFlash: { delta: number; at: number } | null;
}

/** asset: bigger is better; cost: smaller is better; info: no edge */
type Kind = 'asset' | 'cost' | 'info';

interface Row {
  label: string;
  buy: number | null;
  rent: number | null;
  kind: Kind;
}

/** Positive favours buying. */
function edgeOf(row: Row): number {
  if (row.kind === 'info') return 0;
  const buy = row.buy ?? 0;
  const rent = row.rent ?? 0;
  return row.kind === 'asset' ? buy - rent : rent - buy;
}

function Edge({ value }: { value: number }) {
  if (Math.abs(value) < 500) return <span className="text-muted">–</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span aria-hidden className={`h-2 w-2 rounded-sm ${value > 0 ? 'bg-buy' : 'bg-rent'}`} />
      {value > 0 ? 'Buy' : 'Rent'} {formatCompactCurrency(Math.abs(value))}
    </span>
  );
}

export default function LedgerTable({
  final: s,
  property,
  sellYear,
  horizon,
  realTerms,
  deflator,
  onSellYearChange,
  changeFlash,
}: LedgerTableProps) {
  const offset = s.mortgageNetPosition - s.mortgageEquity - s.mortgageInvestmentValue;
  const homeAfterSale = s.mortgagePropertyValue - s.mortgageSaleCosts - s.mortgageLoanBalance;
  const buyerSharesAfterTax = s.mortgageNetPositionAfterSale - homeAfterSale - offset;
  const purchaseCosts = (upfrontCostsOf(property) + (property.lmi ?? 0)) / deflator;

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'What you own',
      rows: [
        { label: 'Home value', buy: s.mortgagePropertyValue, rent: null, kind: 'asset' },
        { label: 'Loan still owed', buy: -s.mortgageLoanBalance, rent: null, kind: 'asset' },
        ...(Math.abs(offset) > 1 ? [{ label: 'Offset savings', buy: offset, rent: null, kind: 'asset' as const }] : []),
        { label: 'Shares', buy: s.mortgageInvestmentValue, rent: s.rentInvestmentValue, kind: 'asset' },
        {
          label: 'Selling costs and tax',
          buy: -(s.mortgageSaleCosts + s.mortgageInvestmentValue - buyerSharesAfterTax),
          rent: s.rentNetPositionAfterTax - s.rentNetPosition,
          kind: 'asset',
        },
      ],
    },
    {
      title: 'What you paid along the way',
      rows: [
        { label: 'Mortgage interest', buy: s.mortgageTotalInterest, rent: null, kind: 'cost' },
        { label: 'Maintenance, rates and insurance', buy: s.mortgageMaintenance + s.mortgageRates + s.mortgageInsurance, rent: null, kind: 'cost' },
        { label: 'Rent, moving and contents insurance', buy: null, rent: s.rentTotalPaid + s.rentMovingCosts + s.rentInsurance, kind: 'cost' },
        { label: (property.firstHomeGrant ?? 0) > 0 ? 'Purchase costs, less the grant' : 'Stamp duty and purchase costs', buy: purchaseCosts, rent: null, kind: 'cost' },
        ...(s.rentSpent + s.mortgageSpent > 0.5
          ? [{ label: 'Savings spent, not invested', buy: s.mortgageSpent, rent: s.rentSpent, kind: 'cost' as const }]
          : []),
      ],
    },
    {
      title: 'Savings invested',
      rows: [{ label: 'New money put into shares', buy: s.mortgageContributions, rent: s.rentContributions, kind: 'info' }],
    },
  ];

  const net = s.mortgageNetPositionAfterSale - s.rentNetPositionAfterTax;
  const cell = (v: number | null) => (v === null ? <span className="text-muted">–</span> : formatCurrency(v));

  return (
    <section aria-label="Ledger" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">
            The books, if you sell after <span className="font-mono font-medium">{sellYear}</span> {sellYear === 1 ? 'year' : 'years'}
          </h1>
          <span className="text-sm text-muted">{realTerms ? "Today's dollars" : 'Future dollars'}</span>
        </div>
        <label className="flex items-center gap-4">
          <span className="sr-only">Sell after</span>
          <span className="font-mono text-xs text-muted">1</span>
          <input
            type="range"
            min={1}
            max={horizon}
            value={sellYear}
            onChange={(e) => onSellYearChange(Number(e.target.value))}
            aria-valuetext={`${sellYear} years`}
            className="flex-1 accent-[var(--color-ink)]"
          />
          <span className="font-mono text-xs text-muted">{horizon}</span>
        </label>
        <div aria-live="polite" className="min-h-7">
          {changeFlash && Math.abs(changeFlash.delta) >= 500 && (
            <span key={changeFlash.at} className="change-flash inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-[13px]">
              <span aria-hidden className={`h-2 w-2 rounded-full ${changeFlash.delta > 0 ? 'bg-rent' : 'bg-buy'}`} />
              Your change moved it <span className="font-mono">{formatCompactCurrency(Math.abs(changeFlash.delta))}</span> toward{' '}
              {changeFlash.delta > 0 ? 'renting' : 'buying'}
            </span>
          )}
        </div>
      </div>

      <div className="card relative overflow-x-auto">
        {/* Fixed columns, so they don't resize as the figures change length while you drag the slider */}
        <table className="w-full min-w-[600px] table-fixed border-collapse text-[15px] [&_td]:whitespace-nowrap [&_thead_th]:whitespace-nowrap">
          <colgroup>
            <col />
            <col className="w-[9.5rem]" />
            <col className="w-[9.5rem]" />
            <col className="w-[9rem]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="eyebrow px-4 py-4 text-left">Line item</th>
              <th scope="col" className="px-4 py-4 text-right text-sm font-semibold">
                <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-buy" />Buy</span>
              </th>
              <th scope="col" className="px-4 py-4 text-right text-sm font-semibold">
                <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-rent" />Rent + invest</span>
              </th>
              <th scope="col" className="eyebrow px-4 py-4 text-right">Edge</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.title}>
              <tr>
                <th scope="rowgroup" colSpan={4} className="border-t border-line px-4 pt-4 pb-2 text-left text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-4 py-2 text-left font-normal text-ink-2">{row.label}</th>
                  <td className="px-4 py-2 text-right font-mono">{cell(row.buy)}</td>
                  <td className="px-4 py-2 text-right font-mono">{cell(row.rent)}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm text-ink-2"><Edge value={edgeOf(row)} /></td>
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t-2 border-line-strong">
              <th scope="row" className="px-4 py-4 text-left text-base font-bold">Net worth after selling</th>
              <td className="px-4 py-4 text-right font-mono text-lg font-medium">{formatCurrency(s.mortgageNetPositionAfterSale)}</td>
              <td className="px-4 py-4 text-right font-mono text-lg font-medium">{formatCurrency(s.rentNetPositionAfterTax)}</td>
              <td className="px-4 py-4 text-right font-mono font-semibold"><Edge value={net} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="m-0 max-w-3xl text-[13px] leading-relaxed text-muted">
        Both start with {formatCurrency(property.deposit + upfrontCostsOf(property) + (property.offsetAccountBalance ?? 0))}
        {' '}(deposit, stamp duty, costs{(property.firstHomeGrant ?? 0) > 0 ? ' less the grant' : ''} and offset savings) and spend the same each month. Costs paid along the way are already
        reflected in the balances above them; "Edge" shows which side each line favours.
      </p>
    </section>
  );
}
