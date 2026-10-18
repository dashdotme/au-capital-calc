import type { InvestmentInputs, PropertyInputs, RentInputs, ScenarioValue } from '../types';
import { isAuState } from './stampDuty';

/** Everything needed to reproduce a view. Lives in the URL hash, which never leaves the browser. */
export interface SharedState {
  property: PropertyInputs;
  rent: RentInputs;
  investment: InvestmentInputs;
  horizon: number;
  sellYear: number | null;
  scenarioMode: boolean;
  realTerms: boolean;
  /** Household income before tax, for the affordability check */
  income: number | null;
}

const HASH_KEY = 's';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeState(state: SharedState): string {
  return `${HASH_KEY}=${toBase64Url(JSON.stringify(state))}`;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isScenario = (v: unknown): v is ScenarioValue =>
  typeof v === 'object' && v !== null &&
  isNumber((v as ScenarioValue).pessimistic) && isNumber((v as ScenarioValue).baseline) && isNumber((v as ScenarioValue).optimistic);

/** Copy only well-typed fields from untrusted input over the defaults. */
function mergeTyped<T extends object>(defaults: T, input: unknown): T {
  if (typeof input !== 'object' || input === null) return defaults;
  const result = { ...defaults } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (isNumber(fallback) || isScenario(fallback)) {
      if (isNumber(value) || isScenario(value)) result[key] = value;
    } else if (typeof fallback === typeof value) {
      result[key] = value;
    }
  }
  return result as T;
}

export function decodeState(hash: string, defaults: SharedState): SharedState | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const encoded = params.get(HASH_KEY);
  if (!encoded) return null;
  try {
    const raw = JSON.parse(fromBase64Url(encoded)) as Partial<SharedState>;
    const horizon = isNumber(raw.horizon) ? Math.max(1, Math.min(60, Math.round(raw.horizon))) : defaults.horizon;
    return {
      property: {
        ...mergeTyped(defaults.property, raw.property),
        location: typeof raw.property?.location === 'string' ? raw.property.location : undefined,
        // No state (including links made before stamp duty was calculated) keeps the shared figure
        state: isAuState(raw.property?.state) ? raw.property.state : undefined,
        // Older links carry a hand-entered LMI figure
        lmiEstimated: raw.property?.lmiEstimated === true || undefined,
      },
      rent: mergeTyped(defaults.rent, raw.rent),
      investment: {
        ...mergeTyped(defaults.investment, raw.investment),
        // A missing preset id means the shared values were customised
        portfolio: typeof raw.investment?.portfolio === 'string' ? raw.investment.portfolio : undefined,
      },
      horizon,
      sellYear: isNumber(raw.sellYear) ? Math.max(1, Math.min(horizon, Math.round(raw.sellYear))) : null,
      scenarioMode: typeof raw.scenarioMode === 'boolean' ? raw.scenarioMode : defaults.scenarioMode,
      realTerms: typeof raw.realTerms === 'boolean' ? raw.realTerms : defaults.realTerms,
      income: isNumber(raw.income) && raw.income > 0 ? raw.income : null,
    };
  } catch {
    return null;
  }
}
