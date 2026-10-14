import type { GapDriver } from '../utils/gap';
import { formatCompactCurrency } from '../utils/format';

interface GapExplainerProps {
  drivers: GapDriver[];
  sellYear: number;
}

/** Diverging bars: each driver pushes the result toward buying (left) or renting (right). */
export default function GapExplainer({ drivers, sellYear }: GapExplainerProps) {
  const net = drivers.reduce((sum, d) => sum + d.amount, 0);
  const sorted = [...drivers].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const scale = Math.max(...drivers.map((d) => Math.abs(d.amount)), Math.abs(net), 1);
  const buyWins = net > 0;

  const row = (label: string, amount: number, emphasis = false) => {
    const width = (Math.abs(amount) / scale) * 50;
    const helpsBuy = amount > 0;
    return (
      <li key={label} className={`grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_7rem] ${
        emphasis ? 'border-t border-line-strong font-semibold' : 'border-t border-line'
      }`}>
        <span className="text-sm">{label}</span>
        <div className="relative h-2.5 rounded-full bg-line/60" aria-hidden>
          <div className="absolute -inset-y-1 left-1/2 w-px bg-ink/40" />
          <div
            className={`absolute inset-y-0 rounded-full ${helpsBuy ? 'bg-buy' : 'bg-rent'} ${emphasis ? '' : 'opacity-85'}`}
            style={helpsBuy ? { right: '50%', width: `${width}%` } : { left: '50%', width: `${width}%` }}
          />
        </div>
        <span className="font-mono text-sm sm:text-right">
          {Math.abs(amount) < 500 ? '≈ $0' : `${helpsBuy ? 'Buy' : 'Rent'} +${formatCompactCurrency(Math.abs(amount))}`}
        </span>
      </li>
    );
  };

  return (
    <section aria-label="Why the result comes out this way" className="card flex flex-col gap-3.5 px-5 py-6 sm:px-7">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">Why {buyWins ? 'buying' : 'renting'} comes out ahead after {sellYear} years</h2>
        <p className="m-0 text-[13px] text-ink-2">
          Both start with the same savings and spend the same each month, so the gap is exactly these parts.
        </p>
      </div>
      <div className="flex justify-between px-1 text-xs text-muted sm:ml-[14rem] sm:mr-[8rem]">
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-sm bg-buy" />← helps buying</span>
        <span className="flex items-center gap-1.5">helps renting →<span aria-hidden className="h-2 w-2 rounded-sm bg-rent" /></span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {sorted.map((d) => row(d.label, d.amount))}
        {row('Net result', net, true)}
      </ul>
    </section>
  );
}
