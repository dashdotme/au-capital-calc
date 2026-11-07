import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { InvestmentInputs, MonteCarloResults, PropertyInputs, RentInputs } from './types';
import {
  calculateMortgagePayment,
  findBuyCrossoverYear,
  isScenarioValue,
  resolveScenarioValue,
  runComparison,
  runScenarioComparison,
  toRealTerms,
} from './utils/calculations';
import { calculateBreakEven } from './utils/breakeven';
import { monteCarloToRealTerms, runMonteCarloSimulation } from './utils/monteCarlo';
import type { MonteCarloRequest } from './utils/monteCarlo.worker';
import { explainGap } from './utils/gap';
import { INVESTED_SHARES } from './utils/narrative';
import {
  DEFAULT_HORIZON,
  DEFAULT_INVESTMENT,
  DEFAULT_PROPERTY,
  DEFAULT_RENT,
  MONTE_CARLO_ITERATIONS,
} from './defaults';
import AssumptionsPanel from './components/AssumptionsPanel';
import KeyFigures from './components/KeyFigures';
import OutcomeChart from './components/OutcomeChart';
import FlipList from './components/FlipList';
import SentenceView from './components/SentenceView';
import LedgerTable from './components/LedgerTable';
import GuidedFlow from './components/GuidedFlow';
import SqueezeView from './components/SqueezeView';
import InvestCalculator from './components/InvestCalculator';
import Segmented from './components/Segmented';
import PageMenu from './components/PageMenu';
import HousingExplainer from './components/HousingExplainer';
import SiteFooter from './components/SiteFooter';
import PriceToIncomeCallout from './components/PriceToIncomeCallout';
import { priceToIncome } from './utils/priceToIncome';
import { ThemeContext, type Theme } from './components/chartTheme';
import FocusAnalysis from './components/FocusAnalysis';
import RiskView from './components/RiskView';
import Affordability from './components/Affordability';
import SavedScenarios, { type SavedScenario } from './components/SavedScenarios';
import PrintReport from './components/PrintReport';
import PortfolioComparison from './components/PortfolioComparison';
import { PORTFOLIOS, applyPortfolio } from './portfolios';
import {
  DEFAULT_STATE, buildHash, decodeInvestState, decodeState, defaultInvestState, encodeInvestState, encodeState, parseHash,
  type InvestState, type Mode, type Page, type SharedState,
} from './utils/shareState';
import { withPurchaseCosts } from './utils/homeBuyerSupport';

type View = Mode | 'risk';

const VIEW_KEY = 'rent-or-buy.view';
const PAGE_TITLES: Record<Page, string> = { buy: 'Rent or Buy', invest: 'Property or Shares', learn: 'The Long Run' };
/** Set once someone finds the AI Squeeze through the corner easter egg */
const SQUEEZE_UNLOCKED_KEY = 'rent-or-buy.squeeze-unlocked';
const THEME_KEY = 'rent-or-buy.theme';

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; ignore storage failures
  }
}

const SAVED_KEY = 'rent-or-buy.saved.v1';

/** Saved scenarios live in localStorage as share-link payloads, so they get the same validation. */
function loadSaved(): SavedScenario[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as { id: string; name: string; hash: string }[];
    return raw.flatMap((item) => {
      const state = decodeState(item.hash, DEFAULT_STATE);
      return state && typeof item.name === 'string' ? [{ id: String(item.id), name: item.name, state }] : [];
    });
  } catch {
    return [];
  }
}

function storeSaved(saved: SavedScenario[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved.map((x) => ({ id: x.id, name: x.name, hash: encodeState(x.state) }))));
  } catch {
    // Storage unavailable (private mode, quota): saved scenarios last for this visit only
  }
}

/** Accumulated effect of the user's recent edits on the rent-minus-buy advantage. */
interface ChangeFlash {
  start: number;
  delta: number;
  at: number;
}


/**
 * Easter egg: hovering the very bottom-right corner (desktop) slides out a handwritten note
 * that opens the AI Squeeze view.
 */
/** A small robot peeking up from the bottom-right corner. */
function Robot() {
  return (
    <svg width="44" height="52" viewBox="0 0 44 52" aria-hidden className="robot-wobble">
      <line x1="22" y1="4" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="4" r="3" className="robot-blink fill-rent" />
      <rect x="6" y="12" width="32" height="24" rx="7" className="fill-surface" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="23" r="3" fill="currentColor" />
      <circle cx="28" cy="23" r="3" fill="currentColor" />
      <path d="M17 30q5 3 10 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="2" y="20" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="38" y="20" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="11" y="38" width="22" height="14" rx="4" className="fill-surface" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SqueezeEgg({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="pointer-events-none fixed right-0 bottom-0 z-20 hidden items-end gap-1 pr-4 lg:flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={`mb-12 origin-bottom-right transition-all duration-300 ${
          open ? 'pointer-events-auto scale-100 opacity-100' : 'translate-x-4 translate-y-4 scale-90 opacity-0'
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={onOpen}
          className="-rotate-3 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-right font-[Caveat] text-[21px] leading-[1.05] font-semibold text-ink-2 shadow-lg hover:text-ink"
        >
          beep boop. want to see what robots
          <br />
          think robots might do to the markets?
        </button>
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open the AI squeeze"
        onClick={onOpen}
        className={`pointer-events-auto text-ink-2 transition-all duration-300 hover:text-ink ${
          open ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-60'
        }`}
      >
        <Robot />
      </button>
    </div>
  );
}

export default function RentVsMortgageCalculator() {
  // A shared link (#rent-or-buy?price=…, or an old #s=…) restores someone else's scenario
  const [link] = useState(() => parseHash(window.location.hash));
  const [initial] = useState(() =>
    (link.page === 'buy' ? decodeState(window.location.hash, DEFAULT_STATE) : null) ?? DEFAULT_STATE);
  const [page, setPage] = useState<Page>(link.page ?? 'buy');
  const [investState, setInvestState] = useState<InvestState>(() =>
    link.page === 'invest' ? decodeInvestState(link.params) : defaultInvestState());
  const [propertyInputs, setPropertyInputs] = useState<PropertyInputs>(() => withPurchaseCosts(initial.property));
  const [rentInputs, setRentInputs] = useState<RentInputs>(initial.rent);
  const [investmentInputs, setInvestmentInputs] = useState<InvestmentInputs>(initial.investment);
  const [timeHorizon, setTimeHorizon] = useState(initial.horizon);
  const [sellYearSetting, setSellYearSetting] = useState<number | null>(initial.sellYear);
  const [scenarioMode, setScenarioMode] = useState(initial.scenarioMode);
  const [realTerms, setRealTerms] = useState(initial.realTerms);
  const [income, setIncome] = useState<number | null>(initial.income);
  const [saved, setSaved] = useState<SavedScenario[]>(loadSaved);
  const [changeFlash, setChangeFlash] = useState<ChangeFlash | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [focusMetric, setFocusMetric] = useState<string | null>(null);
  const [mainView, setMainView] = useState<Mode>(() => link.mode ?? readPref<Mode>(VIEW_KEY, ['simple', 'ledger', 'squeeze'], 'simple'));
  const [showRisk, setShowRisk] = useState(false);
  const view: View = showRisk && page === 'buy' ? 'risk' : mainView;
  /** Property or shares has Simple and Ledger only */
  const investView = mainView === 'ledger' ? 'ledger' : 'simple';
  const [theme, setTheme] = useState<Theme>(() => readPref<Theme>(THEME_KEY, ['light', 'dark'], 'light'));
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePref(THEME_KEY, theme);
  }, [theme]);

  const [squeezeUnlocked, setSqueezeUnlocked] = useState(
    () => mainView === 'squeeze' || readPref(SQUEEZE_UNLOCKED_KEY, ['yes', 'no'], 'no') === 'yes'
  );

  const switchPage = (next: Page) => {
    setPage(next);
    setShowRisk(false);
    window.scrollTo({ top: 0 });
  };

  const switchView = (next: Mode) => {
    setMainView(next);
    setShowRisk(false);
    writePref(VIEW_KEY, next);
    if (next === 'squeeze' && !squeezeUnlocked) {
      setSqueezeUnlocked(true);
      writePref(SQUEEZE_UNLOCKED_KEY, 'yes');
    }
  };
  const [monteCarloRun, setMonteCarloRun] = useState<{ results: MonteCarloResults; inputsKey: string } | null>(null);
  const [monteCarloRunning, setMonteCarloRunning] = useState(false);

  const inflationRate = investmentInputs.inflationRate;
  // null means "at the end of the horizon", so it follows horizon changes
  const sellYear = Math.min(sellYearSetting ?? timeHorizon, timeHorizon);

  const currentState: SharedState = {
    property: propertyInputs,
    rent: rentInputs,
    investment: investmentInputs,
    horizon: timeHorizon,
    sellYear: sellYearSetting,
    scenarioMode,
    realTerms,
    income,
  };
  // The address bar always holds a link to what's on screen, readable and without defaults
  const query = page === 'buy' ? encodeState(currentState) : page === 'invest' ? encodeInvestState(investState) : '';
  const hash = buildHash(page, mainView, query);
  useEffect(() => {
    window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname + window.location.search);
  }, [hash]);

  // Heavy derived views (break-even search, scenarios, portfolio comparison) follow a
  // deferred copy of the inputs so typing stays responsive on slower devices.
  const deferredProperty = useDeferredValue(propertyInputs);
  const deferredRent = useDeferredValue(rentInputs);
  const deferredInvestment = useDeferredValue(investmentInputs);
  const deferredHorizon = useDeferredValue(timeHorizon);
  const inputsKey = JSON.stringify([propertyInputs, rentInputs, investmentInputs, timeHorizon]);
  const monteCarloStale = monteCarloRun !== null && monteCarloRun.inputsKey !== inputsKey;

  const nominalBaseline = useMemo(
    () => runComparison(propertyInputs, rentInputs, investmentInputs, timeHorizon),
    [propertyInputs, rentInputs, investmentInputs, timeHorizon]
  );
  const nominalScenarios = useMemo(
    () => (scenarioMode ? runScenarioComparison(deferredProperty, deferredRent, deferredInvestment, deferredHorizon) : null),
    [scenarioMode, deferredProperty, deferredRent, deferredInvestment, deferredHorizon]
  );
  const breakEvenYear = Math.min(sellYear, deferredHorizon);
  const breakEvenResults = useMemo(
    () => calculateBreakEven(deferredProperty, deferredRent, deferredInvestment, breakEvenYear),
    [deferredProperty, deferredRent, deferredInvestment, breakEvenYear]
  );

  const baseline = realTerms ? toRealTerms(nominalBaseline, inflationRate) : nominalBaseline;
  // While the deferred scenarios catch up after a horizon change, fall back to none
  const scenariosInSync = nominalScenarios !== null && nominalScenarios.baseline.length === nominalBaseline.length;
  const scenarios = !scenariosInSync ? null : nominalScenarios && realTerms
    ? {
        pessimistic: toRealTerms(nominalScenarios.pessimistic, inflationRate),
        baseline: toRealTerms(nominalScenarios.baseline, inflationRate),
        optimistic: toRealTerms(nominalScenarios.optimistic, inflationRate),
      }
    : nominalScenarios;
  const final = baseline[sellYear];
  const crossoverYear = findBuyCrossoverYear(nominalBaseline);
  const monteCarloResults = monteCarloRun
    ? realTerms
      ? monteCarloToRealTerms(monteCarloRun.results, inflationRate, timeHorizon)
      : monteCarloRun.results
    : null;

  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);

  const runMonteCarlo = () => {
    setMonteCarloRunning(true);
    const id = ++requestRef.current;
    const keyAtRequest = inputsKey;
    const finish = (results: MonteCarloResults) => {
      if (id !== requestRef.current) return; // a newer run superseded this one
      setMonteCarloRun({ results, inputsKey: keyAtRequest });
      setMonteCarloRunning(false);
    };
    try {
      workerRef.current ??= new Worker(new URL('./utils/monteCarlo.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current.onmessage = (event: MessageEvent<{ id: number; results: MonteCarloResults }>) => {
        if (event.data.id === id) finish(event.data.results);
      };
      const request: MonteCarloRequest = {
        id,
        property: propertyInputs,
        rent: rentInputs,
        investment: investmentInputs,
        years: timeHorizon,
        iterations: MONTE_CARLO_ITERATIONS,
      };
      workerRef.current.postMessage(request);
    } catch {
      // No worker support: run inline after letting the "running" state paint
      setTimeout(() => {
        finish(runMonteCarloSimulation(propertyInputs, rentInputs, investmentInputs, timeHorizon, MONTE_CARLO_ITERATIONS));
      }, 30);
    }
  };

  useEffect(() => () => workerRef.current?.terminate(), []);

  const openRisk = () => {
    setShowRisk(true);
    setAssumptionsOpen(false);
    window.scrollTo({ top: 0 });
    if (!monteCarloRun || monteCarloStale) runMonteCarlo();
  };

  /** Rent-minus-buy advantage at the chosen sell year, in the displayed dollar basis. */
  const advantageFor = (p: PropertyInputs, r: RentInputs, i: InvestmentInputs, h: number) => {
    const year = Math.min(sellYearSetting ?? h, h);
    const s = runComparison(p, r, i, h)[year];
    const advantage = s.rentNetPositionAfterTax - s.mortgageNetPositionAfterSale;
    return realTerms ? advantage / Math.pow(1 + i.inflationRate / 100, year) : advantage;
  };

  /** Apply an input edit and record how far it moved the result (edits within 2.5s add up). */
  const updateInputs = (next: { p?: PropertyInputs; r?: RentInputs; i?: InvestmentInputs; h?: number }) => {
    // Stamp duty, grant and LMI follow price, deposit, state and buyer unless entered by hand
    if (next.p) next = { ...next, p: withPurchaseCosts(next.p) };
    const p = next.p ?? propertyInputs;
    const r = next.r ?? rentInputs;
    const i = next.i ?? investmentInputs;
    const h = next.h ?? timeHorizon;
    const now = Date.now();
    const start = changeFlash && now - changeFlash.at < 2500
      ? changeFlash.start
      : advantageFor(propertyInputs, rentInputs, investmentInputs, timeHorizon);
    setChangeFlash({ start, delta: advantageFor(p, r, i, h) - start, at: now });
    if (next.p) setPropertyInputs(next.p);
    if (next.r) setRentInputs(next.r);
    if (next.i) setInvestmentInputs(next.i);
    if (next.h !== undefined) setTimeHorizon(next.h);
  };

  const loadScenario = (scenario: SavedScenario) => {
    const { state } = scenario;
    updateInputs({ p: state.property, r: state.rent, i: state.investment, h: state.horizon });
    setSellYearSetting(state.sellYear);
    setScenarioMode(state.scenarioMode);
    setRealTerms(state.realTerms);
    setIncome(state.income);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveScenario = (name: string) => {
    const next = [...saved, { id: String(Date.now()), name, state: currentState }];
    setSaved(next);
    storeSaved(next);
  };

  const deleteScenario = (id: string) => {
    const next = saved.filter((x) => x.id !== id);
    setSaved(next);
    storeSaved(next);
  };

  const resetInputs = () => {
    updateInputs({ p: DEFAULT_PROPERTY, r: DEFAULT_RENT, i: DEFAULT_INVESTMENT, h: DEFAULT_HORIZON });
    setSellYearSetting(null);
    setFocusMetric(null);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', window.location.href);
    }
  };

  const openFocus = (metric: string | null) => {
    setFocusMetric(metric);
    if (metric) {
      setAssumptionsOpen(false);
      switchView('ledger');
      requestAnimationFrame(() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const monthlyRepayment = calculateMortgagePayment(
    propertyInputs.propertyPrice - propertyInputs.deposit + (propertyInputs.lmi ?? 0),
    resolveScenarioValue(propertyInputs.interestRate, 'baseline'),
    propertyInputs.loanTerm
  );
  const buyWins = final.rentNetPositionAfterTax < final.mortgageNetPositionAfterSale;

  const setSell = (year: number) => setSellYearSetting(year >= timeHorizon ? null : year);

  // Price-to-income check on the growth assumption (nominal: incomes and prices in the same dollars)
  const growthBaseline = resolveScenarioValue(investmentInputs.propertyGrowthRate, 'baseline');
  const affordabilityCheck = priceToIncome(propertyInputs, rentInputs, nominalBaseline[sellYear].mortgagePropertyValue, sellYear);
  const matchIncomes = () => {
    const delta = affordabilityCheck.incomeGrowth - growthBaseline;
    const shift = (v: number) => Math.round((v + delta) * 100) / 100;
    const g = investmentInputs.propertyGrowthRate;
    updateInputs({
      i: {
        ...investmentInputs,
        propertyGrowthRate: isScenarioValue(g)
          ? { pessimistic: shift(g.pessimistic), baseline: shift(g.baseline), optimistic: shift(g.optimistic) }
          : shift(g),
      },
    });
  };
  const realityCheck = (
    <PriceToIncomeCallout check={affordabilityCheck} sellYear={sellYear} propertyGrowth={growthBaseline} onMatchIncomes={matchIncomes} />
  );
  const growthNote = `${affordabilityCheck.atSale.toFixed(1)}× median household income in ${affordabilityCheck.area} by year ${sellYear} (${affordabilityCheck.now.toFixed(1)}× today).`;
  const deflator = realTerms ? Math.pow(1 + inflationRate / 100, sellYear) : 1;
  const drivers = explainGap(final, propertyInputs, deflator);

  const printIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
  const linkIcon = linkCopied ? (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M6.5 9.5a3 3 0 004.2 0l2.3-2.3a3 3 0 00-4.2-4.2L7.6 4.2M9.5 6.5a3 3 0 00-4.2 0L3 8.8a3 3 0 004.2 4.2l1.2-1.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  );
  const themeIcon = theme === 'light' ? (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
  );
  const iconButton = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2 hover:border-line-strong hover:text-ink';

  const scenarioToggle = (
    <Segmented
      label="Scenario mode"
      value={scenarioMode}
      onChange={setScenarioMode}
      options={[{ value: false, label: 'Single' }, { value: true, label: '3 scenarios' }]}
    />
  );
  const dollarToggle = (
    <Segmented
      label="Dollar basis"
      value={realTerms}
      onChange={setRealTerms}
      options={[{ value: false, label: 'Future $' }, { value: true, label: "Today's $" }]}
    />
  );

  const assumptionsPanel = (
    <AssumptionsPanel
      propertyInputs={propertyInputs}
      rentInputs={rentInputs}
      investmentInputs={investmentInputs}
      timeHorizon={timeHorizon}
      onPropertyChange={(p) => updateInputs({ p })}
      onRentChange={(r) => updateInputs({ r })}
      onPropertyAndRentChange={(p, r) => updateInputs({ p, r })}
      onInvestmentChange={(i) => updateInputs({ i })}
      onTimeHorizonChange={(h) => updateInputs({ h })}
      onReset={resetInputs}
      scenarioMode={scenarioMode}
      focusMetric={focusMetric}
      onFocusMetric={openFocus}
      monthlyRepayment={monthlyRepayment}
      growthNote={growthNote}
    />
  );
  const affordabilityCard = <Affordability property={propertyInputs} income={income} onIncomeChange={setIncome} />;
  const savedCard = (
    <SavedScenarios saved={saved} current={currentState} onSave={saveScenario} onLoad={loadScenario} onDelete={deleteScenario} />
  );
  const portfolioCard = (
    <PortfolioComparison
      propertyInputs={deferredProperty}
      rentInputs={deferredRent}
      investmentInputs={deferredInvestment}
      timeHorizon={deferredHorizon}
      sellYear={breakEvenYear}
      onSelect={(id) => {
        const preset = PORTFOLIOS.find((x) => x.id === id);
        if (preset) updateInputs({ i: applyPortfolio(investmentInputs, preset) });
      }}
    />
  );

  return (
    <ThemeContext.Provider value={theme}>
      <div className={`min-h-screen bg-ground text-ink print:hidden ${view === 'ledger' && page !== 'learn' ? 'pb-24 lg:pb-0' : ''}`}>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex min-h-11 items-center gap-3">
              {view === 'risk' && (
                <button
                  type="button"
                  onClick={() => setShowRisk(false)}
                  className="min-h-10 rounded-lg border border-line px-3 text-[13px] text-ink-2 hover:text-ink"
                >
                  ← Back
                </button>
              )}
              {view === 'risk'
                ? <span className="text-lg font-bold tracking-tight sm:text-xl">Risk</span>
                : <PageMenu page={page} titles={PAGE_TITLES} onSelect={switchPage} />}
              {view === 'risk' && (
                <span className="hidden text-[13px] text-ink-2 md:inline">
                  {MONTE_CARLO_ITERATIONS.toLocaleString('en-AU')} simulated futures · baseline assumptions
                </span>
              )}
            </div>
            {/* Same height whichever controls show, so the Risk view doesn't nudge the header */}
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              {view === 'risk' ? (
                <button
                  type="button"
                  onClick={runMonteCarlo}
                  disabled={monteCarloRunning}
                  className="min-h-10 min-w-[5.5rem] rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-semibold disabled:opacity-50"
                >
                  {monteCarloRunning ? 'Running…' : 'Re-run'}
                </button>
              ) : page !== 'learn' && (
                <Segmented
                  label="View"
                  value={page === 'invest' ? investView : mainView}
                  onChange={switchView}
                  options={[
                    { value: 'simple', label: 'Simple' },
                    { value: 'ledger', label: 'Ledger' },
                    // Hidden until found through the corner easter egg, then kept
                    ...(squeezeUnlocked && page === 'buy' ? [{ value: 'squeeze' as const, label: 'AI Squeeze' }] : []),
                  ]}
                />
              )}
              <button
                type="button"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                className={iconButton}
              >
                {themeIcon}
              </button>
              {page !== 'learn' && (
              <button type="button" onClick={copyLink} aria-label={linkCopied ? 'Link copied' : 'Copy link to this scenario'}
                className={`${iconButton} sm:w-auto sm:min-w-[7.25rem] sm:gap-2 sm:px-3 sm:text-[13px]`}>
                {/* Wide enough for "Copy link", so switching to "Copied" doesn't shift the header */}
                {linkIcon}
                <span className="hidden sm:inline" aria-live="polite">{linkCopied ? 'Copied' : 'Copy link'}</span>
              </button>
              )}
              {/* The PDF report covers rent or buy only */}
              {page === 'buy' && (<>
              <button type="button" onClick={() => window.print()} aria-label="Export PDF"
                className={`${iconButton} sm:w-auto sm:gap-2 sm:px-3 sm:text-[13px]`}>
                {printIcon}
                <span className="hidden sm:inline">Export PDF</span>
              </button>
              </>)}
            </div>
          </div>
        </header>

        {view === 'risk' && (
          <main className="mx-auto min-h-screen max-w-[1240px] px-4 py-10 sm:px-6">
            <RiskView
              results={monteCarloResults}
              running={monteCarloRunning}
              stale={monteCarloStale}
              timeHorizon={timeHorizon}
              realTerms={realTerms}
              onRerun={runMonteCarlo}
            />
          </main>
        )}

        {page === 'buy' && view === 'simple' && (
          <SentenceView
            property={propertyInputs}
            rent={rentInputs}
            investment={investmentInputs}
            horizon={timeHorizon}
            sellYear={sellYear}
            realTerms={realTerms}
            baseline={baseline}
            scenarios={scenarios}
            breakEvens={breakEvenResults.results}
            drivers={drivers}
            changeFlash={changeFlash}
            onPropertyAndRentChange={(p, r) => updateInputs({ p, r })}
            onInvestmentChange={(i) => updateInputs({ i })}
            onSellYearChange={setSell}
            onOpenAssumptions={() => setAssumptionsOpen(true)}
            onOpenGuide={() => setGuideOpen(true)}
            onOpenRisk={openRisk}
            affordability={affordabilityCard}
            savedScenarios={savedCard}
            portfolioComparison={portfolioCard}
            investedOutcomes={INVESTED_SHARES.map(({ value }) => ({
              share: value,
              advantage: advantageFor(propertyInputs, rentInputs, { ...investmentInputs, investedShare: value }, timeHorizon),
            }))}
            realityCheck={realityCheck}
            neverMoveAdvantage={(propertyInputs.ownerMoveFrequency ?? 0) > 0
              ? advantageFor({ ...propertyInputs, ownerMoveFrequency: 0 }, rentInputs, investmentInputs, timeHorizon)
              : null}
          />
        )}

        {page === 'invest' && (
          <InvestCalculator state={investState} onChange={setInvestState} view={investView} onOpenLearn={() => switchPage('learn')} />
        )}

        {page === 'learn' && (
          <HousingExplainer onOpenInvest={() => switchPage('invest')} onOpenCalculator={() => switchPage('buy')} />
        )}

        {page === 'buy' && view === 'squeeze' && (
          <SqueezeView
            property={propertyInputs}
            rent={rentInputs}
            investment={investmentInputs}
            horizon={timeHorizon}
            sellYear={sellYear}
            onSellYearChange={setSell}
            income={income}
            onIncomeChange={setIncome}
          />
        )}

        {page === 'buy' && view === 'ledger' && (
          <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-start gap-6 px-4 pt-6 pb-10 sm:px-6 lg:grid-cols-[minmax(340px,390px)_minmax(0,1fr)]">
            <div className="order-2 lg:sticky lg:top-6 lg:order-1 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:rounded-xl">
              {assumptionsPanel}
            </div>
            <main className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
              <div className="flex flex-wrap gap-2">
                {scenarioToggle}
                {dollarToggle}
              </div>
              {realityCheck}
              <LedgerTable
                final={final}
                property={propertyInputs}
                sellYear={sellYear}
                horizon={timeHorizon}
                realTerms={realTerms}
                deflator={deflator}
                onSellYearChange={setSell}
                changeFlash={changeFlash}
              />
              <KeyFigures
                baseline={baseline}
                sellYear={sellYear}
                scenarioResults={scenarios}
                crossoverYear={crossoverYear}
                timeHorizon={timeHorizon}
                monteCarloBuyProbability={monteCarloRun && !monteCarloStale ? monteCarloRun.results.buyBetterProbability : null}
                onOpenRisk={openRisk}
              />
              {focusMetric && (
                <div id="explore" className="scroll-mt-6">
                  <FocusAnalysis
                    key={focusMetric}
                    metricKey={focusMetric}
                    propertyInputs={propertyInputs}
                    rentInputs={rentInputs}
                    investmentInputs={investmentInputs}
                    timeHorizon={timeHorizon}
                    onClose={() => setFocusMetric(null)}
                  />
                </div>
              )}
              <OutcomeChart
                baseline={baseline}
                scenarioResults={scenarios}
                crossoverYear={crossoverYear}
                sellYear={sellYear}
                onSellYearChange={setSell}
              />
              <FlipList breakEvens={breakEvenResults.results} buyWins={buyWins} onExplore={openFocus} />
              {portfolioCard}
              {affordabilityCard}
              {savedCard}
              <p className="m-0 max-w-3xl text-xs leading-relaxed text-muted">
                Both households start with the same savings and spend the same each month. Whichever option is cheaper that
                month invests the difference.
              </p>
            </main>
          </div>
        )}

        <SiteFooter />
        {!squeezeUnlocked && !showRisk && page === 'buy' && <SqueezeEgg onOpen={() => { switchView('squeeze'); window.scrollTo(0, 0); }} />}

        {page === 'buy' && view === 'ledger' && (
          <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 border-t border-line bg-ground/95 px-4 pt-3 pb-5 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => document.getElementById('assumptions')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-ink text-[15px] font-semibold text-ground"
            >
              Edit assumptions
            </button>
            <button type="button" onClick={openRisk} className="min-h-12 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold">
              Risk
            </button>
          </div>
        )}

        {assumptionsOpen && page === 'buy' && view === 'simple' && (
          <div className="fixed inset-0 z-40 flex justify-end">
            <button type="button" aria-label="Close assumptions" onClick={() => setAssumptionsOpen(false)} className="absolute inset-0 bg-black/30" />
            <div role="dialog" aria-modal="true" aria-label="All assumptions"
              className="relative flex h-full w-full max-w-[420px] flex-col gap-3 overflow-y-auto bg-ground p-4 shadow-2xl"
              onKeyDown={(e) => e.key === 'Escape' && setAssumptionsOpen(false)}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold">All assumptions</span>
                <button type="button" autoFocus onClick={() => setAssumptionsOpen(false)} className="min-h-10 rounded-lg border border-line px-3 text-sm text-ink-2 hover:text-ink">
                  Done
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {scenarioToggle}
                {dollarToggle}
              </div>
              {assumptionsPanel}
            </div>
          </div>
        )}

        {guideOpen && (
          <GuidedFlow
            property={propertyInputs}
            rent={rentInputs}
            investment={investmentInputs}
            horizon={timeHorizon}
            onClose={() => setGuideOpen(false)}
            onApply={({ property, rent, investment, sellYear: year }) => {
              updateInputs({ p: property, r: rent, i: investment });
              setSell(year);
              setGuideOpen(false);
              switchView('simple');
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </div>
      <div className="hidden print:block">
        <PrintReport
          state={currentState}
          baseline={baseline}
          scenarios={scenarios}
          sellYear={sellYear}
          crossoverYear={crossoverYear}
          breakEvens={breakEvenResults.results}
          monteCarlo={monteCarloStale ? null : monteCarloResults}
        />
      </div>
    </ThemeContext.Provider>
  );
}
