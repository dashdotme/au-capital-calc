# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AU Capital Calc is a set of Australian financial calculators: renting vs buying a home (the main one), an investment property vs a share ETF, and an explainer on long-run house prices. It models long-term wealth outcomes by simulating mortgage payments, property appreciation, investment returns, and Australian tax implications including franking credits and capital gains tax.

## Common Commands

- `npm run dev` - Start development server with HMR
- `npm run build` - Type-check with TypeScript and build for production
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally
- `npm test` - Run engine invariant tests (`src/utils/calculations.test.ts`), falsification tests (`src/utils/falsifiability.test.ts`: closed-form oracles, accounting identities, metamorphic relations, seeded fuzz) retirement/move tests (`src/utils/retirement.test.ts`, checked against published Services Australia and ATO figures) and investment property tests (`src/utils/investmentProperty.test.ts`, checked against the Budget 2026–27 tax explainer cameo, QRO's duty example and the state land tax schedules) and share-link tests (`src/utils/shareState.test.ts`)

## Architecture

### Core Calculation Flow

The application follows a unidirectional data flow:

1. **State Management** (`RentVsMortgageCalculator.tsx`): The main component holds three input state objects (`PropertyInputs`, `RentInputs`, `InvestmentInputs`) plus a time horizon parameter
2. **Calculation Engine** (`utils/calculations.ts`): The `runComparison()` function processes all inputs and returns an array of `YearlySnapshot` objects spanning the entire time horizon
3. **Results Display**: Components consume the snapshot array to render summaries and charts

### Comparison Model (equal-budget net worth)

- Both households start with the same capital: deposit + stamp duty + other costs + offset balance. The buyer spends it on the purchase and keeps the offset as cash; the renter invests all of it.
- Each month both spend the same total: whichever option has lower housing costs that month invests the difference (the buyer gets a side portfolio once owning becomes cheaper, e.g. after the loan is paid off). `InvestmentInputs.investedShare` (default 100%) invests only part of that saving; the rest is spent and tracked as `rentSpent` / `mortgageSpent`, which the gap breakdown counts so it still adds up.
- "Net position" fields are net worths, directly comparable. `...AfterSale` / `...AfterTax` liquidate everything: selling costs, property CGT, brokerage and stock CGT on gains over the true cost base.
- Do not subtract costs paid from net worth: the equal-budget setup already accounts for them, and subtracting again double counts.
- Owner moves (`ownerMoveFrequency`) are owner costs in the month they happen: selling costs, full-rate stamp duty on a same-value home (`moveStampDuty`), purchase costs and removalists. Strata levies are an owner running cost.
- By default the buyer's spare cash fills the offset before buying shares (`buyerSurplusToOffset`). `superShare` salary-sacrifices part of each invested saving into a super `Portfolio` (15% tax, two-thirds of gains taxed) until pension age; contributions count the after-tax dollars given up.
- From pension age (67) each household gets the means-tested age pension (`utils/retirement.ts`); the home is exempt from the assets test and renters' rent assistance is tested with the pension. Pension income counts like a housing saving: whoever gets more invests the difference.

### Key Calculation Functions

- `runComparison()` - Monthly simulation returning one `YearlySnapshot` per year. Accepts optional per-year `RatePaths` (used by Monte Carlo); the loan is variable-rate and re-amortises when the rate changes.
- `Portfolio` class - Share holdings with cost base, monthly total return split into dividends + price growth, franking credits (refunded when they exceed tax).
- `withMetric()` / `getMetricValue()` - Shared single-metric overrides used by break-even and focus analysis.
- `findBuyCrossoverYear()`, `toRealTerms()` - Crossover holding period and today's-dollars deflation.
- `monteCarlo.ts` - Path-based simulation: each path samples long-run averages plus correlated annual shocks (Cholesky on `DEFAULT_CORRELATION_MATRIX`), seeded PRNG.

### Australian Tax Specifics

- **Stock return is total return** (dividends included); dividend yield only changes how much is taxed annually vs deferred as capital gains
- **Franking credits**: grossed up at the 30% company rate; excess credits are refunded
- **CGT**: the home is CGT-free by default (`capitalGainsTaxRate` 0; any rate set uses the 50% discount on a cost base including purchase and selling costs). Shares follow `InvestmentInputs.cgtRules`: `'reform'` (default, law) applies the 2027 rules from `monthsToReform` (computed from today if unset; tests pin it): the gain to 1 Jul 2027 keeps the 50% discount, later gains are indexed to CPI and taxed in full with a 30% minimum (`utils/cgtReform.ts`; age pensioners exempt from the minimum; super funds keep their discount, a judgment call). `'old'` keeps the 50% discount. `Portfolio` sells proportionally, so one indexed cost base is exact. Shares are sold at the flat marginal rate by default; `spreadSale` instead spreads the gain over `saleYears` and two people (couple) through the 2027–28 brackets on top of `saleIncome`
- **Thresholds in retirement.ts** are 2026 dollars scaled by inflation (a judgment call; documented in the file header)
- **Marginal tax rate**: stage 3 brackets including the 2% Medicare levy
- **Stamp duty**: `utils/stampDuty.ts` holds 2026–27 owner-occupier schedules and first home buyer relief per state, including new-home exemptions. When `PropertyInputs.state` is set it is recalculated on every input update; no state means a manual figure
- **First home buyer support**: `utils/homeBuyerSupport.ts` holds first home owner grants (new homes), the 5% Deposit Scheme (waives LMI under the price cap) and a rough LMI estimate. `withPurchaseCosts()` derives stamp duty, `firstHomeGrant` and LMI (when `lmiEstimated`); the root applies it on every input update. The grant reduces upfront costs via `upfrontCostsOf()`

### Component Structure

- `RentVsMortgageCalculator.tsx` - Root: all state, derived results, URL sync, theme, pages and views. The header title is a menu (`PageMenu.tsx`) switching between the two calculators (Rent or Buy, Property or Shares) and the Learn page; Simple / Ledger applies to both calculators
- **Links** (`utils/shareState.ts`): the hash names the page and view and holds only values that differ from the defaults, e.g. `#rent-or-buy/ledger?city=sydney&deposit=250k`, `#property-or-shares?kind=established&price=700k`. A city or share preset is written by name and the rest diffed against it; derived figures (stamp duty, grant, estimated LMI) are left out. Plain rent-or-buy with defaults has no hash. Old `#s=<base64>` links, and saved scenarios stored that way, still decode. Every key is listed in `BUY_FIELDS` / `INVEST_FIELDS`; untrusted values are type-checked and clamped
- **Simple view** (default): `SentenceView.tsx` - the scenario as an editable sentence (`SentencePill.tsx` popovers), a plain-language answer from `utils/narrative.ts`, an "if you sold earlier" chart, why-cards and optional panels; `GuidedFlow.tsx` is the opt-in four-question first-visit flow
- **Ledger view**: `AssumptionsPanel.tsx` sidebar plus `LedgerTable.tsx` (line-by-line buy vs rent at the sell year), `KeyFigures`, `OutcomeChart`, `FocusAnalysis` (Explore), `FlipList`
- **Risk view**: `RiskView.tsx` (Monte Carlo, run in `utils/monteCarlo.worker.ts`)
- **Property or Shares** (`#property-or-shares`): `InvestCalculator.tsx` (container, Ledger view, ledger/sensitivity/caveat cards), `InvestSentenceView.tsx` (Simple view: the scenario as a sentence, the answer, a "What decides it" card for price growth, rent increases, interest rate and share returns, a chart of the lead by sale year shaded for growth ±1 point, why-cards) and `InvestAssumptions.tsx`, over `utils/investmentProperty.ts`, a separate monthly model of a geared rental vs a share ETF for one salaried investor. Same equal-budget rule (the property's after-tax shortfall is invested by the shares side; its surplus goes into a side ETF). Models the 2026–27 Budget reforms (law) from 1 Jul 2027: CGT indexation with a 30% minimum tax on real gains (pre-Jul-2027 gains keep the 50% discount; ETF parcels tracked by purchase date), negative gearing only for new builds (established-home losses are quarantined and carried forward against rent and the gain), and the new-build choice of the 50% discount. `rules: 'old'` switches to the pre-reform rules for comparison. Investor stamp duty is `investorStampDuty()` (general rates); house-and-land pays duty on the land only. Land tax is `utils/landTax.ts` (2026–27 schedules per state, on the land's share of the value; SA thresholds follow land values, ACT charges follow inflation, the rest stay put). Loans are interest-only for `ioYears` then P&I over the rest of 30 years; LMI above 80% is added to the loan; new builds take the same first-10-years growth drag as rent-or-buy; while a new build is under construction, interest, council rates and land tax aren't deductible and go into the cost base. Rent first rises 12 months after the home is let. Capital works and fittings (plant) written off come off the cost base at the amount claimed (fittings aren't also in the capital works base); for a property held across 1 Jul 2027, deductions and holding costs after that date belong to the indexed part of the gain, not the discounted part. Indexation can cancel a gain but not create a loss (also in `Portfolio`). `IpYear.rentalTax` is the tax effect of the rental alone; `taxDifference` also nets off the share investor's distribution tax, so don't show it as the property's tax saving. Inputs live in the link.
- **How It Works page** (`#how-it-works`, `#how-it-works/property-or-shares`): `ModelGuide.tsx` lists every input and built-in rule of both calculators with defaults read from `defaults.ts` and the model files, marks values the reader has changed, and says what each model leaves out. When you add or change an input, a default or a fixed rule, update its row there
- **Learn page** (`#learn`): `HousingExplainer.tsx`, a static explainer (borrowing power vs rates, price-to-income arithmetic, land vs buildings, housing vs shares) with its sources listed in the file header
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
- Every hard-coded number gets a comment saying where it comes from (source and date) or, if it's a judgment call, saying so ("Rough:" / "judgment call"). City presets document their sources in the `cities.ts` header
- Percentage rates in inputs are stored as numbers (e.g., 4.5 for 4.5%) and converted to decimals in calculations
- The amortization schedule accounts for offset accounts by reducing the effective balance for interest calculations while maintaining the full balance for principal
