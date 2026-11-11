import type { InvestmentInputs, PropertyInputs, RentInputs, ScenarioValue } from '../types';
import { DEFAULT_HORIZON, DEFAULT_INVESTMENT, DEFAULT_IP, DEFAULT_PROPERTY, DEFAULT_RENT } from '../defaults';
import { CITIES, applyCity } from '../cities';
import { PORTFOLIOS, applyPortfolio } from '../portfolios';
import { monthsUntilReform, type IpInputs } from './investmentProperty';
import { isAuState } from './stampDuty';

// Links carry everything in the URL hash, which never leaves the browser. They read like
//   #rent-or-buy/ledger?city=sydney&deposit=250k&years=20
//   #property-or-shares?kind=established&price=700k
// Only values that differ from the defaults are written, and picking a city or share
// portfolio writes just its name. Links from before this format (#s=<base64 JSON>) still open.

/** Everything needed to reproduce a rent-or-buy view. */
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

/** Everything needed to reproduce a property-or-shares view. */
export interface InvestState {
  ip: IpInputs;
  /** null: sell at the end of the horizon (`ip.years`) */
  sellYear: number | null;
  realTerms: boolean;
}

export const DEFAULT_STATE: SharedState = {
  property: DEFAULT_PROPERTY,
  rent: DEFAULT_RENT,
  investment: DEFAULT_INVESTMENT,
  horizon: DEFAULT_HORIZON,
  sellYear: null,
  scenarioMode: true,
  realTerms: false,
  income: null,
};

export const defaultInvestState = (): InvestState => ({
  ip: { ...DEFAULT_IP, monthsToReform: monthsUntilReform(new Date()) },
  sellYear: null,
  realTerms: false,
});

// ---- Pages -------------------------------------------------------------------------------

export type Page = 'buy' | 'invest' | 'learn' | 'method';
/** Which calculator the How It Works page describes */
export type GuideTab = 'buy' | 'invest';
export type Mode = 'simple' | 'ledger' | 'squeeze';

export const PAGE_SLUGS: Record<Page, string> = { buy: 'rent-or-buy', invest: 'property-or-shares', learn: 'learn', method: 'how-it-works' };
const SLUGS = new Map<string, Page>([
  ['rent-or-buy', 'buy'],
  ['buy', 'buy'],
  ['property-or-shares', 'invest'],
  ['invest', 'invest'],
  ['learn', 'learn'],
  ['how-it-works', 'method'],
  ['method', 'method'],
  ['assumptions', 'method'],
]);
const MODES = new Map<string, Mode>([['ledger', 'ledger'], ['squeeze', 'squeeze'], ['simple', 'simple']]);

export interface ParsedHash {
  page: Page | null;
  mode: Mode | null;
  /** On the How It Works page, the calculator named after the slash (#how-it-works/property-or-shares) */
  guide: GuideTab | null;
  params: URLSearchParams;
  /** A link in the old #s=<base64> format */
  legacy: string | null;
}

export function parseHash(hash: string): ParsedHash {
  const raw = hash.replace(/^#\/?/, '');
  if (raw.startsWith('s=')) return { page: 'buy', mode: null, guide: null, params: new URLSearchParams(), legacy: raw };
  const [path, query = ''] = raw.split('?', 2);
  const [slug = '', mode = ''] = path.toLowerCase().split('/');
  const page = SLUGS.get(slug) ?? null;
  const section = SLUGS.get(mode);
  const guide = page === 'method' && (section === 'buy' || section === 'invest') ? section : null;
  return { page, mode: MODES.get(mode) ?? null, guide, params: new URLSearchParams(query), legacy: null };
}

/** The hash for a page, without "#"; empty for the plain rent-or-buy page with no changes. */
export function buildHash(page: Page, mode: Mode, query: string, guide: GuideTab = 'buy'): string {
  if (page === 'method') return guide === 'invest' ? `${PAGE_SLUGS.method}/${PAGE_SLUGS.invest}` : PAGE_SLUGS.method;
  const showMode = page === 'learn' || mode === 'simple' || (mode === 'squeeze' && page !== 'buy') ? '' : `/${mode}`;
  const path = `${PAGE_SLUGS[page]}${showMode}`;
  if (page === 'buy' && !showMode && !query) return '';
  return query ? `${path}?${query}` : path;
}

// ---- Values ------------------------------------------------------------------------------

/** 850000 → "850k", 1250000 → "1.25m", 6.25 → "6.25" */
export function formatParam(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000 && Math.round(abs) % 10_000 === 0) return `${+(n / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000 && Math.round(abs) % 1_000 === 0 && Number.isInteger(n)) return `${n / 1_000}k`;
  return String(+n.toFixed(4));
}

export function parseParam(text: string): number | null {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))([km]?)$/i.exec(text.trim());
  if (!match) return null;
  const n = parseFloat(match[1]) * (match[2].toLowerCase() === 'm' ? 1e6 : match[2].toLowerCase() === 'k' ? 1e3 : 1);
  return Number.isFinite(n) ? n : null;
}

type Kind = 'num' | 'scenario' | 'bool' | 'text';
/** URL key, dotted path into the state, value kind */
type Field = readonly [key: string, path: string, kind: Kind];

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isScenario = (v: unknown): v is ScenarioValue =>
  typeof v === 'object' && v !== null &&
  isNumber((v as ScenarioValue).pessimistic) && isNumber((v as ScenarioValue).baseline) && isNumber((v as ScenarioValue).optimistic);

const getPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[k] : undefined), obj);

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  const last = keys.pop()!;
  let target = obj;
  for (const k of keys) {
    target[k] = { ...(target[k] as object) };
    target = target[k] as Record<string, unknown>;
  }
  target[last] = value;
}

function formatValue(value: unknown, base: unknown, kind: Kind): string | null {
  if (kind === 'bool') return typeof value === 'boolean' ? (value ? 'yes' : 'no') : null;
  if (kind === 'text') return typeof value === 'string' ? value : null;
  if (isNumber(value)) return formatParam(value);
  if (!isScenario(value)) return null;
  // Only the middle figure changed: write just that
  if (isScenario(base) && value.pessimistic === base.pessimistic && value.optimistic === base.optimistic) return formatParam(value.baseline);
  return [value.pessimistic, value.baseline, value.optimistic].map(formatParam).join(',');
}

function parseValue(text: string, base: unknown, kind: Kind): unknown {
  if (kind === 'bool') return ['yes', 'true', '1'].includes(text) ? true : ['no', 'false', '0'].includes(text) ? false : undefined;
  if (kind === 'text') return text;
  if (kind === 'num') return parseParam(text) ?? undefined;
  const parts = text.split(',').map(parseParam);
  if (parts.some((p) => p === null)) return undefined;
  if (parts.length === 3) return { pessimistic: parts[0]!, baseline: parts[1]!, optimistic: parts[2]! };
  if (parts.length !== 1) return undefined;
  return isScenario(base) ? { ...base, baseline: parts[0]! } : parts[0]!;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function encodeFields(fields: readonly Field[], state: unknown, base: unknown, skip: Set<string>, params: URLSearchParams) {
  for (const [key, path, kind] of fields) {
    if (skip.has(key)) continue;
    const value = getPath(state, path);
    const fallback = getPath(base, path);
    if (value === undefined || same(value, fallback)) continue;
    const text = formatValue(value, fallback, kind);
    if (text !== null) params.set(key, text);
  }
}

function decodeFields<T extends object>(fields: readonly Field[], params: URLSearchParams, base: T): T {
  const result = structuredClone(base) as Record<string, unknown>;
  for (const [key, path, kind] of fields) {
    const text = params.get(key);
    if (text === null) continue;
    const value = parseValue(text, getPath(base, path), kind);
    if (value !== undefined) setPath(result, path, value);
  }
  return result as T;
}

// ---- Rent or buy -------------------------------------------------------------------------

export const BUY_FIELDS: readonly Field[] = [
  ['years', 'horizon', 'num'],
  ['sell', 'sellYear', 'num'],
  ['price', 'property.propertyPrice', 'num'],
  ['deposit', 'property.deposit', 'num'],
  ['state', 'property.state', 'text'],
  ['first-home', 'property.firstHomeBuyer', 'bool'],
  ['new', 'property.newHome', 'bool'],
  ['rate', 'property.interestRate', 'scenario'],
  ['term', 'property.loanTerm', 'num'],
  ['duty', 'property.stampDuty', 'num'],
  ['grant', 'property.firstHomeGrant', 'num'],
  ['lmi', 'property.lmi', 'num'],
  ['lmi-estimated', 'property.lmiEstimated', 'bool'],
  ['purchase-costs', 'property.otherPurchaseCosts', 'num'],
  ['maintenance', 'property.maintenanceRate', 'num'],
  ['council', 'property.councilRates', 'num'],
  ['building-insurance', 'property.buildingInsurance', 'num'],
  ['owner-contents', 'property.contentsInsurance', 'num'],
  ['strata', 'property.strataLevies', 'num'],
  ['selling', 'property.sellingCostRate', 'num'],
  ['property-cgt', 'property.capitalGainsTaxRate', 'num'],
  ['offset', 'property.offsetAccountBalance', 'num'],
  ['owner-moves', 'property.ownerMoveFrequency', 'num'],
  ['rent', 'rent.monthlyRent', 'num'],
  ['rent-growth', 'rent.rentIncreaseRate', 'scenario'],
  ['moves', 'rent.movingFrequency', 'num'],
  ['moving-cost', 'rent.movingCost', 'num'],
  ['renter-contents', 'rent.contentsInsurance', 'num'],
  ['growth', 'investment.propertyGrowthRate', 'scenario'],
  ['shares-return', 'investment.stockMarketReturn', 'scenario'],
  ['yield', 'investment.dividendYield', 'num'],
  ['franking', 'investment.frankingLevel', 'num'],
  ['fee', 'investment.managementFee', 'num'],
  ['volatility', 'investment.stockVolatility', 'num'],
  ['brokerage', 'investment.stockTransactionCost', 'num'],
  ['reinvest', 'investment.dividendReinvestment', 'bool'],
  ['tax-rate', 'investment.marginalTaxRate', 'num'],
  ['inflation', 'investment.inflationRate', 'num'],
  ['invested', 'investment.investedShare', 'num'],
  ['surplus-to-offset', 'investment.buyerSurplusToOffset', 'bool'],
  ['age', 'investment.age', 'num'],
  ['couple', 'investment.couple', 'bool'],
  ['super', 'investment.superShare', 'num'],
  ['super-room', 'investment.superCapRoom', 'num'],
  ['spread-sale', 'investment.spreadSale', 'bool'],
  ['sale-years', 'investment.saleYears', 'num'],
  ['sale-income', 'investment.saleIncome', 'num'],
  ['tax-rules', 'investment.cgtRules', 'text'],
  ['income', 'income', 'num'],
  ['scenarios', 'scenarioMode', 'bool'],
  ['todays-dollars', 'realTerms', 'bool'],
];

/** Values a city preset fills in; editing one by hand drops the city name */
const CITY_KEYS = ['price', 'rent', 'state', 'duty', 'council', 'building-insurance'];
/** Values a portfolio preset fills in */
const PORTFOLIO_KEYS = ['shares-return', 'yield', 'franking', 'fee', 'volatility'];

/** Defaults with a city and portfolio preset applied, the base a link is written against */
function buyBase(cityId: string | undefined, portfolioId: string | undefined): SharedState {
  const city = CITIES.find((c) => c.id === cityId);
  const portfolio = PORTFOLIOS.find((p) => p.id === portfolioId);
  const [property, rent] = city ? applyCity(DEFAULT_PROPERTY, DEFAULT_RENT, city) : [DEFAULT_PROPERTY, DEFAULT_RENT];
  const investment = portfolio ? applyPortfolio(DEFAULT_INVESTMENT, portfolio) : DEFAULT_INVESTMENT;
  return { ...DEFAULT_STATE, property, rent, investment };
}

/** The query string for a rent-or-buy scenario: only what differs from the defaults. */
export function encodeState(state: SharedState): string {
  const params = new URLSearchParams();
  const city = state.property.location;
  const portfolio = state.investment.portfolio;
  if (city && city !== DEFAULT_PROPERTY.location) params.set('city', city);
  if (portfolio && portfolio !== DEFAULT_INVESTMENT.portfolio) params.set('shares', portfolio);
  const skip = new Set<string>();
  // Worked out from the price, state and buyer on load
  if (state.property.state) skip.add('duty').add('grant');
  if (state.property.lmiEstimated) skip.add('lmi');
  encodeFields(BUY_FIELDS, state, buyBase(city, portfolio), skip, params);
  return params.toString().replace(/%2C/g, ',');
}

/**
 * A rent-or-buy scenario from a query string ("price=900k&…"), a hash ("#rent-or-buy?…"), or an
 * old "s=<base64>" link. Null when there's nothing to restore.
 */
export function decodeState(input: string, defaults: SharedState = DEFAULT_STATE): SharedState | null {
  const text = input.replace(/^#\/?/, '');
  if (text.startsWith('s=')) return decodeLegacy(text, defaults);
  const params = new URLSearchParams(text.includes('?') ? text.split('?')[1] : /^[\w-]+=/.test(text) ? text : '');
  if ([...params.keys()].length === 0) return null;
  const cityId = params.get('city') ?? undefined;
  const portfolioId = params.get('shares') ?? undefined;
  const city = CITIES.find((c) => c.id === cityId);
  const portfolio = PORTFOLIOS.find((p) => p.id === portfolioId);
  const raw = decodeFields(BUY_FIELDS, params, buyBase(city?.id, portfolio?.id));
  // A hand-edited city or portfolio value means the scenario no longer matches the preset
  if (!city && CITY_KEYS.some((k) => params.has(k))) raw.property = { ...raw.property, location: undefined };
  if (!portfolio && PORTFOLIO_KEYS.some((k) => params.has(k))) raw.investment = { ...raw.investment, portfolio: undefined };
  return validate(raw, defaults);
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function decodeLegacy(text: string, defaults: SharedState): SharedState | null {
  const encoded = new URLSearchParams(text).get('s');
  if (!encoded) return null;
  try {
    return validate(JSON.parse(fromBase64Url(encoded)), defaults);
  } catch {
    return null;
  }
}

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

function validate(raw: Partial<SharedState>, defaults: SharedState): SharedState {
  const horizon = isNumber(raw.horizon) ? Math.max(1, Math.min(60, Math.round(raw.horizon))) : defaults.horizon;
  return {
    property: {
      ...mergeTyped(defaults.property, raw.property),
      location: CITIES.some((c) => c.id === raw.property?.location) ? raw.property!.location : undefined,
      // No state (including links made before stamp duty was calculated) keeps the shared figure
      state: isAuState(raw.property?.state) ? raw.property.state : undefined,
      // Older links carry a hand-entered LMI figure
      lmiEstimated: raw.property?.lmiEstimated === true || undefined,
    },
    rent: mergeTyped(defaults.rent, raw.rent),
    investment: {
      ...mergeTyped(defaults.investment, raw.investment),
      // A missing preset id means the shared values were customised
      portfolio: PORTFOLIOS.some((p) => p.id === raw.investment?.portfolio) ? raw.investment!.portfolio : undefined,
      // Links made before the reform was modelled have no rules and get today's law
      cgtRules: raw.investment?.cgtRules === 'old' ? 'old' : 'reform',
    },
    horizon,
    sellYear: isNumber(raw.sellYear) ? Math.max(1, Math.min(horizon, Math.round(raw.sellYear))) : null,
    scenarioMode: typeof raw.scenarioMode === 'boolean' ? raw.scenarioMode : defaults.scenarioMode,
    realTerms: typeof raw.realTerms === 'boolean' ? raw.realTerms : defaults.realTerms,
    income: isNumber(raw.income) && raw.income > 0 ? raw.income : null,
  };
}

// ---- Property or shares ------------------------------------------------------------------

export const INVEST_FIELDS: readonly Field[] = [
  ['kind', 'ip.kind', 'text'],
  ['state', 'ip.state', 'text'],
  ['price', 'ip.price', 'num'],
  ['loan', 'ip.lvr', 'num'],
  ['salary', 'ip.salary', 'num'],
  ['years', 'ip.years', 'num'],
  ['sell', 'sellYear', 'num'],
  ['rules', 'ip.rules', 'text'],
  ['land', 'ip.landShare', 'num'],
  ['build-months', 'ip.buildMonths', 'num'],
  ['rate', 'ip.interestRate', 'num'],
  ['interest-only-years', 'ip.ioYears', 'num'],
  ['growth', 'ip.growth', 'num'],
  ['yield', 'ip.grossYield', 'num'],
  ['rent-growth', 'ip.rentGrowth', 'num'],
  ['management', 'ip.management', 'num'],
  ['vacancy', 'ip.vacancy', 'num'],
  ['insurance', 'ip.insurance', 'num'],
  ['council', 'ip.councilRates', 'num'],
  ['strata', 'ip.strata', 'num'],
  ['maintenance', 'ip.maintenance', 'num'],
  ['building', 'ip.capitalWorksBase', 'num'],
  ['fittings', 'ip.plant', 'num'],
  ['purchase-costs', 'ip.purchaseCosts', 'num'],
  ['selling', 'ip.sellingCosts', 'num'],
  ['shares-return', 'ip.etfReturn', 'num'],
  ['fee', 'ip.etfFee', 'num'],
  ['distributions', 'ip.etfYield', 'num'],
  ['franking', 'ip.franking', 'num'],
  ['pay-rises', 'ip.salaryGrowth', 'num'],
  ['inflation', 'ip.inflation', 'num'],
  ['todays-dollars', 'realTerms', 'bool'],
];

const SHARE_PRESETS = PORTFOLIOS.filter((p) => p.id !== 'cash');

/** Share presets for the property-or-shares page, with the fields they fill */
export const ipPortfolioFields = (p: (typeof PORTFOLIOS)[number]): Pick<IpInputs, 'etfReturn' | 'etfFee' | 'etfYield' | 'franking'> => ({
  etfReturn: p.returns.baseline,
  etfFee: p.managementFee,
  etfYield: p.dividendYield,
  franking: p.frankingLevel,
});

/** The share preset these inputs match, if any */
export function ipPortfolio(ip: IpInputs) {
  return SHARE_PRESETS.find((p) => same(ipPortfolioFields(p), { etfReturn: ip.etfReturn, etfFee: ip.etfFee, etfYield: ip.etfYield, franking: ip.franking }));
}

export const IP_SHARE_PRESETS = SHARE_PRESETS;

export function encodeInvestState(state: InvestState): string {
  const params = new URLSearchParams();
  const fresh = defaultInvestState();
  const preset = ipPortfolio(state.ip);
  let base = fresh;
  if (preset && preset !== ipPortfolio(fresh.ip)) {
    params.set('shares', preset.id);
    base = { ...fresh, ip: { ...fresh.ip, ...ipPortfolioFields(preset) } };
  }
  encodeFields(INVEST_FIELDS, state, base, new Set(), params);
  return params.toString();
}

export function decodeInvestState(params: URLSearchParams): InvestState {
  const fresh = defaultInvestState();
  const preset = SHARE_PRESETS.find((p) => p.id === params.get('shares'));
  const base = preset ? { ...fresh, ip: { ...fresh.ip, ...ipPortfolioFields(preset) } } : fresh;
  const raw = decodeFields(INVEST_FIELDS, params, base);
  const ip = { ...fresh.ip };
  for (const key of Object.keys(fresh.ip) as (keyof IpInputs)[]) {
    // The reform date always comes from today
    if (key !== 'monthsToReform' && typeof raw.ip[key] === typeof fresh.ip[key] && (typeof raw.ip[key] !== 'number' || isNumber(raw.ip[key]))) {
      (ip as Record<string, unknown>)[key] = raw.ip[key];
    }
  }
  if (!isAuState(ip.state)) ip.state = fresh.ip.state;
  if (ip.kind !== 'new' && ip.kind !== 'established') ip.kind = fresh.ip.kind;
  if (ip.rules !== 'reform' && ip.rules !== 'old') ip.rules = fresh.ip.rules;
  ip.years = Math.max(1, Math.min(40, Math.round(ip.years)));
  ip.lvr = Math.max(0, Math.min(100, ip.lvr));
  return {
    ip,
    sellYear: isNumber(raw.sellYear) ? Math.max(1, Math.min(ip.years, Math.round(raw.sellYear))) : null,
    realTerms: raw.realTerms === true,
  };
}
