import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { InvestmentInputs, MonteCarloResults, PropertyInputs, RentInputs } from './types';
import {
  calculateMortgagePayment,
  findBuyCrossoverYear,
  resolveScenarioValue,
  runComparison,
  runScenarioComparison,
  toRealTerms,
} from './utils/calculations';
import { calculateBreakEven } from './utils/breakeven';
import { monteCarloToRealTerms, runMonteCarloSimulation } from './utils/monteCarlo';
import type { MonteCarloRequest } from './utils/monteCarlo.worker';
import { explainGap } from './utils/gap';
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
import SiteFooter from './components/SiteFooter';
import { DISCLAIMER_SHORT } from './site';
import { ThemeContext, type Theme } from './components/chartTheme';
import FocusAnalysis from './components/FocusAnalysis';
import RiskView from './components/RiskView';
import Affordability from './components/Affordability';
import SavedScenarios, { type SavedScenario } from './components/SavedScenarios';
import PrintReport from './components/PrintReport';
import PortfolioComparison from './components/PortfolioComparison';
import { PORTFOLIOS, applyPortfolio } from './portfolios';
import { decodeState, encodeState, type SharedState } from './utils/shareState';

type View = 'simple' | 'ledger' | 'squeeze' | 'risk';
type MainView = Exclude<View, 'risk'>;

const VIEW_KEY = 'rent-or-buy.view';
const THEME_KEY = 'rent-or-buy.theme';
const SQUEEZE_SEEN_KEY = 'rent-or-buy.squeeze-seen';

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

const DEFAULT_STATE: SharedState = {
  property: DEFAULT_PROPERTY,
  rent: DEFAULT_RENT,
  investment: DEFAULT_INVESTMENT,
  horizon: DEFAULT_HORIZON,
  sellYear: null,
  scenarioMode: true,
  realTerms: false,
  income: null,
};

const SAVED_KEY = 'rent-or-buy.saved.v1';

/** Saved scenarios live in localStorage as share-link payloads, so they get the same validation. */
function loadSaved(): SavedScenario[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as { id: string; name: string; hash: string }[];
    return raw.flatMap((item) => {
      const state = decodeState(`#${item.hash}`, DEFAULT_STATE);
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

function Segmented<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line bg-surface p-[3px]">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-md px-2.5 text-[13px] sm:px-3.5 ${
            value === option.value ? 'bg-line font-semibold text-ink' : 'text-ink-2 hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A tongue-in-cheek handwritten note pointing at the AI Squeeze tab (desktop, until visited). */
function SqueezeHint() {
  return (
    <div aria-hidden className="pointer-events-none absolute top-full right-11 mt-1 hidden items-start md:flex">
      <span className="mt-6 mr-1 w-[230px] -rotate-3 text-right font-[Caveat] text-[19px] leading-[1.05] font-semibold text-ink-2">
        and here's what AI thinks AI might do to the markets
      </span>
      <svg width="58" height="54" viewBox="0 0 58 54" fill="none" className="text-ink-2">
        <path
          d="M4 46 C 24 54, 34 40, 22 32 C 12 25, 30 18, 40 22 C 48 25, 47 14, 44 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M37 11 L44 4 L49 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function RentVsMortgageCalculator() {
  // A shared link (#s=…) restores someone else's scenario; otherwise start from defaults
  const [initial] = useState(() => decodeState(window.location.hash, DEFAULT_STATE) ?? DEFAULT_STATE);
  const [propertyInputs, setPropertyInputs] = useState<PropertyInputs>(initial.property);
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
  const [mainView, setMainView] = useState<MainView>(() => readPref<MainView>(VIEW_KEY, ['simple', 'ledger', 'squeeze'], 'simple'));
  const [showRisk, setShowRisk] = useState(false);
  const view: View = showRisk ? 'risk' : mainView;
  const [theme, setTheme] = useState<Theme>(() => readPref<Theme>(THEME_KEY, ['light', 'dark'], 'light'));
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePref(THEME_KEY, theme);
  }, [theme]);

  const [squeezeSeen, setSqueezeSeen] = useState(() => readPref(SQUEEZE_SEEN_KEY, ['yes', 'no'], 'no') === 'yes');

  const switchView = (next: MainView) => {
    setMainView(next);
    setShowRisk(false);
    writePref(VIEW_KEY, next);
    if (next === 'squeeze' && !squeezeSeen) {
      setSqueezeSeen(true);
      writePref(SQUEEZE_SEEN_KEY, 'yes');
    }
  };
  const showSqueezeHint = !squeezeSeen && mainView !== 'squeeze' && !showRisk;
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
  const currentHash = encodeState(currentState);
  useEffect(() => {
    window.history.replaceState(null, '', `#${currentHash}`);
  }, [currentHash]);

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
      <div className={`min-h-screen bg-ground text-ink print:hidden ${view === 'ledger' ? 'pb-24 lg:pb-0' : ''}`}>
        <header className={`border-b border-line ${showSqueezeHint ? 'md:pb-14' : ''}`}>
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              {view === 'risk' && (
                <button
                  type="button"
                  onClick={() => setShowRisk(false)}
                  className="min-h-10 rounded-lg border border-line px-3 text-[13px] text-ink-2 hover:text-ink"
                >
                  ← Back
                </button>
              )}
              <span className="text-lg font-bold tracking-tight sm:text-xl">{view === 'risk' ? 'Risk' : 'Rent or Buy'}</span>
              {view === 'risk' && (
                <span className="hidden text-[13px] text-ink-2 md:inline">
                  {MONTE_CARLO_ITERATIONS.toLocaleString('en-AU')} simulated futures · baseline assumptions
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {view === 'risk' ? (
                <button
                  type="button"
                  onClick={runMonteCarlo}
                  disabled={monteCarloRunning}
                  className="min-h-10 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-semibold disabled:opacity-50"
                >
                  {monteCarloRunning ? 'Running…' : 'Re-run'}
                </button>
              ) : (
                <div className="relative">
                  <Segmented
                    label="View"
                    value={mainView}
                    onChange={switchView}
                    options={[
                      { value: 'simple', label: 'Simple' },
                      { value: 'ledger', label: 'Ledger' },
                      { value: 'squeeze', label: 'AI Squeeze' },
                    ]}
                  />
                  {showSqueezeHint && <SqueezeHint />}
                </div>
              )}
              <button
                type="button"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                className={iconButton}
              >
                {themeIcon}
              </button>
              <button type="button" onClick={copyLink} aria-label={linkCopied ? 'Link copied' : 'Copy link to this scenario'}
                className={`${iconButton} sm:w-auto sm:gap-2 sm:px-3 sm:text-[13px]`}>
                {linkIcon}
                <span className="hidden sm:inline" aria-live="polite">{linkCopied ? 'Copied' : 'Copy link'}</span>
              </button>
              <button type="button" onClick={() => window.print()} aria-label="Export PDF"
                className={`${iconButton} sm:w-auto sm:gap-2 sm:px-3 sm:text-[13px]`}>
                {printIcon}
                <span className="hidden sm:inline">Export PDF</span>
              </button>
            </div>
          </div>
        </header>

        {view === 'risk' && (
          <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
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

        {view === 'simple' && (
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
          />
        )}

        {view === 'squeeze' && (
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

        {view === 'ledger' && (
          <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(340px,390px)_minmax(0,1fr)]">
            <div className="order-2 lg:sticky lg:top-6 lg:order-1 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:rounded-xl">
              {assumptionsPanel}
            </div>
            <main className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
              <div className="flex flex-wrap gap-2">
                {scenarioToggle}
                {dollarToggle}
              </div>
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
                month invests the difference. {DISCLAIMER_SHORT}
              </p>
            </main>
          </div>
        )}

        <SiteFooter />

        {view === 'ledger' && (
          <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 border-t border-line bg-ground/95 px-4 pt-3 pb-5 backdrop-blur lg:hidden">
            <a
              href="#assumptions"
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-ink text-[15px] font-semibold text-ground no-underline"
            >
              Edit assumptions
            </a>
            <button type="button" onClick={openRisk} className="min-h-12 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold">
              Risk
            </button>
          </div>
        )}

        {assumptionsOpen && view === 'simple' && (
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
