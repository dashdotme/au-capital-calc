import { useState } from 'react';
import type { SharedState } from '../utils/shareState';
import { findBuyCrossoverYear, resolveScenarioValue, runComparison } from '../utils/calculations';
import { formatAdvantage, formatCompactCurrency } from '../utils/format';
import { CITIES } from '../cities';
import { PORTFOLIOS } from '../portfolios';

export interface SavedScenario {
  id: string;
  name: string;
  state: SharedState;
}

interface SavedScenariosProps {
  saved: SavedScenario[];
  current: SharedState;
  onSave: (name: string) => void;
  onLoad: (scenario: SavedScenario) => void;
  onDelete: (id: string) => void;
}

function summarise(state: SharedState) {
  const results = runComparison(state.property, state.rent, state.investment, state.horizon);
  const year = Math.min(state.sellYear ?? state.horizon, state.horizon);
  const s = results[year];
  return {
    year,
    advantage: s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale,
    buy: s.mortgageNetPositionAfterSale,
    rent: s.rentNetPositionAfterTax,
    crossover: findBuyCrossoverYear(results),
  };
}

function defaultScenarioName(state: SharedState): string {
  const city = CITIES.find((c) => c.id === state.property.location)?.name ?? formatCompactCurrency(state.property.propertyPrice);
  return `${city} · ${resolveScenarioValue(state.property.interestRate, 'baseline')}% rate`;
}

export default function SavedScenarios({ saved, current, onSave, onLoad, onDelete }: SavedScenariosProps) {
  const [name, setName] = useState('');
  const rows = [
    { id: 'current', name: 'Current (unsaved)', state: current },
    ...saved,
  ].map((scenario) => ({ scenario, summary: summarise(scenario.state) }));

  return (
    <section aria-label="Saved scenarios" className="card flex flex-col gap-4 px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold">Compare scenarios</h2>
          <p className="m-0 text-[13px] text-ink-2">Save versions to compare side by side, e.g. two homes, or buying now vs later.</p>
        </div>
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(name.trim() || defaultScenarioName(current));
            setName('');
          }}
        >
          <input
            aria-label="Scenario name"
            placeholder={defaultScenarioName(current)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field min-w-0 flex-1 font-sans sm:w-56"
          />
          <button type="submit" className="min-h-10 shrink-0 rounded-md bg-ink px-4 text-[13px] font-semibold text-ground">
            Save
          </button>
        </form>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm [&_td]:pl-5 [&_td]:whitespace-nowrap [&_th[scope=col]]:pl-5 [&_th[scope=col]]:whitespace-nowrap">
          <thead>
            <tr className="text-right text-xs text-ink-2">
              <th scope="col" className="pb-2.5 text-left font-medium pl-0!">Scenario</th>
              <th scope="col" className="pb-2.5 font-medium">Sell after</th>
              <th scope="col" className="pb-2.5 font-medium">Result</th>
              <th scope="col" className="pb-2.5 font-medium">Buy</th>
              <th scope="col" className="pb-2.5 font-medium">Rent</th>
              <th scope="col" className="pb-2.5 font-medium">Buy leads from</th>
              <th scope="col" className="pb-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="text-right font-mono">
            {rows.map(({ scenario, summary }) => {
              const isCurrent = scenario.id === 'current';
              const portfolio = PORTFOLIOS.find((x) => x.id === scenario.state.investment.portfolio)?.name ?? 'Custom portfolio';
              return (
                <tr key={scenario.id} className={`border-t border-line ${isCurrent ? 'text-ink-2' : ''}`}>
                  <th scope="row" className="py-2.5 text-left font-sans font-normal">
                    <span className={isCurrent ? 'italic' : 'font-medium text-ink'}>{scenario.name}</span>
                    <span className="block text-xs text-muted">
                      {formatCompactCurrency(scenario.state.property.propertyPrice)} · {formatCompactCurrency(scenario.state.rent.monthlyRent)}/mo rent · {portfolio}
                    </span>
                  </th>
                  <td className="py-2.5">{summary.year} yrs</td>
                  <td className="py-2.5 text-ink">{formatAdvantage(summary.advantage)}</td>
                  <td className="py-2.5">{formatCompactCurrency(summary.buy)}</td>
                  <td className="py-2.5">{formatCompactCurrency(summary.rent)}</td>
                  <td className="py-2.5">{summary.crossover === null ? 'Never' : `Year ${summary.crossover}`}</td>
                  <td className="py-2.5 pl-3 whitespace-nowrap font-sans">
                    {!isCurrent && (
                      <>
                        <button type="button" onClick={() => onLoad(scenario)}
                          className="min-h-8 rounded-md border border-line px-2.5 text-xs text-ink-2 hover:text-ink">Load</button>
                        <button type="button" onClick={() => onDelete(scenario.id)} aria-label={`Delete ${scenario.name}`}
                          className="ml-1.5 min-h-8 rounded-md px-2 text-xs text-muted hover:text-ink">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {saved.length === 0 && (
        <p className="m-0 text-xs text-muted">Saved scenarios stay in this browser only. Use Copy link to share one.</p>
      )}
    </section>
  );
}
