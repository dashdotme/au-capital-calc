# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AU Capital Calc is a financial calculator comparing renting vs buying property in Australia. It models long-term wealth outcomes by simulating mortgage payments, property appreciation, investment returns, and Australian tax implications including franking credits and capital gains tax.

## Common Commands

- `npm run dev` - Start development server with HMR
- `npm run build` - Type-check with TypeScript and build for production
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally

## Architecture

### Core Calculation Flow

The application follows a unidirectional data flow:

1. **State Management** (`RentVsMortgageCalculator.tsx`): The main component holds three input state objects (`PropertyInputs`, `RentInputs`, `InvestmentInputs`) plus a time horizon parameter
2. **Calculation Engine** (`utils/calculations.ts`): The `runComparison()` function processes all inputs and returns an array of `YearlySnapshot` objects spanning the entire time horizon
3. **Results Display**: Components consume the snapshot array to render summaries and charts

### Key Calculation Functions

- `calculateMortgagePayment()` - Standard mortgage payment formula with monthly compounding
- `calculateAmortization()` - Generates year-by-year loan balance, including offset account support
- `calculateFrankingCredits()` - Models Australian dividend franking credits (company tax rate: 30%)
- `runComparison()` - Main simulation loop that:
  - Tracks property ownership costs (mortgage, maintenance, rates, insurance)
  - Tracks rental costs with annual increases and periodic moving costs
  - Simulates monthly investment contributions (rent savings) with dividend reinvestment
  - Applies Australian capital gains tax (50% discount for assets held >12 months)

### Australian Tax Specifics

The calculator implements Australian tax rules:
- **Franking credits**: Dividend imputation system where franking credits can reduce tax or generate refunds if marginal rate < 30%
- **CGT discount**: 50% capital gains discount applied to both property and stocks
- **Marginal tax rate**: Applied to dividends and capital gains

### Component Structure

- `RentVsMortgageCalculator.tsx` - Root component managing all state
- `PropertyInputsCard.tsx` - Mortgage, property costs, offset account
- `RentInputsCard.tsx` - Rent parameters and moving costs
- `InvestmentInputsCard.tsx` - Market returns, dividends, franking, tax rates
- `ResultsSummary.tsx` - Final wealth comparison
- `ComparisonChart.tsx` - Recharts visualization of wealth trajectories
- `InputField.tsx` - Reusable controlled input component

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
