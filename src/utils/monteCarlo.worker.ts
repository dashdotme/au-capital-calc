// Runs the Monte Carlo off the main thread so the page stays responsive while 5,000
// paths are simulated.
import type { InvestmentInputs, PropertyInputs, RentInputs } from '../types';
import { runMonteCarloSimulation } from './monteCarlo';

export interface MonteCarloRequest {
  id: number;
  property: PropertyInputs;
  rent: RentInputs;
  investment: InvestmentInputs;
  years: number;
  iterations: number;
}

self.onmessage = (event: MessageEvent<MonteCarloRequest>) => {
  const { id, property, rent, investment, years, iterations } = event.data;
  const results = runMonteCarloSimulation(property, rent, investment, years, iterations);
  (self as unknown as Worker).postMessage({ id, results });
};
