/**
 * Statistical distribution utilities for Monte Carlo simulation
 */

/** Deterministic PRNG (mulberry32) so simulations are reproducible for a given seed. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform to generate a standard normal from a uniform RNG
 */
export function randomNormal(rng: () => number = Math.random): number {
  const u1 = 1 - rng(); // (0, 1] so log() is finite
  const u2 = rng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Clamp a value to ensure it stays within reasonable bounds
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Order of the variables in the correlation matrix. */
export const SIMULATED_VARIABLES = ['interestRate', 'rentIncreaseRate', 'stockMarketReturn', 'propertyGrowthRate'] as const;
export type SimulatedVariable = (typeof SIMULATED_VARIABLES)[number];

/**
 * Correlations between the simulated variables, in SIMULATED_VARIABLES order. Signs follow the
 * reasoning below; the sizes are judgment calls, not estimates from data.
 * - Higher rates → higher inflation → higher rents (+), lower asset valuations (−)
 * - Rents and property prices are both driven by housing demand (+)
 * - Stocks and property are both driven by economic growth (+)
 */
export const DEFAULT_CORRELATION_MATRIX: number[][] = [
  [1.0, 0.5, -0.3, -0.3],
  [0.5, 1.0, 0.0, 0.4],
  [-0.3, 0.0, 1.0, 0.4],
  [-0.3, 0.4, 0.4, 1.0],
];

/**
 * Cholesky decomposition (lower-triangular L with L·Lᵀ = matrix).
 * Throws if the matrix is not positive definite.
 */
export function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        if (sum <= 0) throw new Error('Correlation matrix is not positive definite');
        L[i][j] = Math.sqrt(sum);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  return L;
}

/** Draw a vector of correlated standard normals using a Cholesky factor. */
export function correlatedNormals(choleskyFactor: number[][], rng: () => number): number[] {
  const z = choleskyFactor.map(() => randomNormal(rng));
  return choleskyFactor.map((row) => row.reduce((sum, l, k) => sum + l * z[k], 0));
}

/**
 * Two layers of uncertainty per variable (all in percentage points):
 * - longRunStdDev: uncertainty in the long-run average itself (are we in a 6% or 10% world?)
 * - annualStdDev: year-to-year volatility around that average. For stocks and property this
 *   is the volatility of log returns, which keeps the median path at the input rate.
 * Interest rates mean-revert to their long-run level rather than being independent each year.
 *
 * Rough calibration to Australian history: shares ~15% a year (ASX 200 and global indices are
 * 14–17%; portfolios override it with their own volatility); a single home's value ~7%, more
 * than city indices (~4–5%) because one home carries its own idiosyncratic risk; rent growth
 * ±1.5 points a year; mortgage rates ±0.6 points a year. The long-run spreads say how unsure the
 * 30-year averages themselves are. Min/max clamps only stop absurd draws.
 */
export interface VariableModel {
  longRunStdDev: number;
  annualStdDev: number;
  min: number;
  max: number;
}

export const DEFAULT_VARIABLE_MODELS: Record<SimulatedVariable, VariableModel> = {
  interestRate: { longRunStdDev: 0.75, annualStdDev: 0.6, min: 0.25, max: 15 },
  rentIncreaseRate: { longRunStdDev: 0.5, annualStdDev: 1.5, min: -5, max: 15 },
  stockMarketReturn: { longRunStdDev: 1.0, annualStdDev: 15, min: -60, max: 80 },
  propertyGrowthRate: { longRunStdDev: 1.0, annualStdDev: 7, min: -30, max: 40 },
};

/** How quickly interest rates revert to their long-run level each year (0-1): a quarter of the gap, so shocks fade over a few years. */
export const INTEREST_RATE_REVERSION = 0.25;

/**
 * Calculate percentile from sorted array
 */
export function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  if (p <= 0) return sortedArray[0];
  if (p >= 100) return sortedArray[sortedArray.length - 1];

  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}
