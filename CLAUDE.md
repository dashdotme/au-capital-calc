# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AU Capital Calc is a financial calculator comparing renting vs buying property in Australia. It models long-term wealth outcomes by simulating mortgage payments, property appreciation, investment returns, and Australian tax implications including franking credits and capital gains tax.

## Common Commands

- `npm run dev` - Start development server with HMR
- `npm run build` - Type-check with TypeScript and build for production
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally
- `npm test` - Run engine invariant tests (`src/utils/calculations.test.ts`)

## Architecture

### Core Calculation Flow

The application follows a unidirectional data flow:

1. **State Management** (`RentVsMortgageCalculator.tsx`): The main component holds three input state objects (`PropertyInputs`, `RentInputs`, `InvestmentInputs`) plus a time horizon parameter
2. **Calculation Engine** (`utils/calculations.ts`): The `runComparison()` function processes all inputs and returns an array of `YearlySnapshot` objects spanning the entire time horizon
3. **Results Display**: Components consume the snapshot array to render summaries and charts

### Comparison Model (equal-budget net worth)

- Both households start with the same capital: deposit + stamp duty + other costs + offset balance. The buyer spends it on the purchase and keeps the offset as cash; the renter invests all of it.
- Each month both spend the same total: whichever option has lower housing costs that month invests the difference (the buyer gets a side portfolio once owning becomes cheaper, e.g. after the loan is paid off).
- "Net position" fields are net worths, directly comparable. `...AfterSale` / `...AfterTax` liquidate everything: selling costs, property CGT, brokerage and stock CGT on gains over the true cost base.
- Do not subtract costs paid from net worth: the equal-budget setup already accounts for them, and subtracting again double counts.

### Key Calculation Functions

- `runComparison()` - Monthly simulation returning one `YearlySnapshot` per year. Accepts optional per-year `RatePaths` (used by Monte Carlo); the loan is variable-rate and re-amortises when the rate changes.
- `Portfolio` class - Share holdings with cost base, monthly total return split into dividends + price growth, franking credits (refunded when they exceed tax).
- `withMetric()` / `getMetricValue()` - Shared single-metric overrides used by break-even and focus analysis.
- `findBuyCrossoverYear()`, `toRealTerms()` - Crossover holding period and today's-dollars deflation.
- `monteCarlo.ts` - Path-based simulation: each path samples long-run averages plus correlated annual shocks (Cholesky on `DEFAULT_CORRELATION_MATRIX`), seeded PRNG.

### Australian Tax Specifics

- **Stock return is total return** (dividends included); dividend yield only changes how much is taxed annually vs deferred as capital gains
- **Franking credits**: grossed up at the 30% company rate; excess credits are refunded
- **CGT discount**: 50% applied to property (cost base includes purchase and selling costs) and stocks
- **Marginal tax rate**: stage 3 brackets including the 2% Medicare levy

### Component Structure

- `RentVsMortgageCalculator.tsx` - Root: all state, derived results, URL/localStorage sync, theme, and the three views
- **Simple view** (default): `SentenceView.tsx` - the scenario as an editable sentence (`SentencePill.tsx` popovers), a plain-language answer from `utils/narrative.ts`, an "if you sold earlier" chart, why-cards and optional panels; `GuidedFlow.tsx` is the opt-in four-question first-visit flow
- **Ledger view**: `AssumptionsPanel.tsx` sidebar plus `LedgerTable.tsx` (line-by-line buy vs rent at the sell year), `KeyFigures`, `OutcomeChart`, `FocusAnalysis` (Explore), `FlipList`
- **Risk view**: `RiskView.tsx` (Monte Carlo, run in `utils/monteCarlo.worker.ts`)
- Shared cards: `GapExplainer`, `PortfolioComparison`, `Affordability`, `SavedScenarios`; `PrintReport.tsx` renders only when printing (Export PDF)
- `chartTheme.ts` - light/dark palettes; charts read colours through `useChart()` and `ThemeContext`, CSS tokens switch on `html[data-theme]`

### Technology Stack

- **React 19** with React Compiler enabled (babel-plugin-react-compiler)
- **Vite** using rolldown-vite (Rolldown bundler)
- **TypeScript** with strict type checking
- **Tailwind CSS v4** via PostCSS
- **Recharts** for data visualization

## Development Notes

- The React Compiler is enabled in `vite.config.ts`, which automatically optimizes component memoization
- All calculations use `useMemo` to recompute only when inputs change
- Percentage rates in inputs are stored as numbers (e.g., 4.5 for 4.5%) and converted to decimals in calculations
- The amortization schedule accounts for offset accounts by reducing the effective balance for interest calculations while maintaining the full balance for principal
