// Shared chart styling. Buy and Rent keep the same colour in every chart; scenarios
// and percentiles vary by line weight/dash, never by hue.
// Buy/Rent avoid party colours (red, blue, green, teal, orange, yellow): Buy is light
// warm sand, Rent a muted violet. They differ in lightness as well as hue, and the
// pair is validated for CVD separation and contrast against the surface (#111b2e).

export const SERIES = {
  buy: '#d8c9a8',
  rent: '#8b6fc9',
} as const;

/** Ordinal ramp (light -> dark) for the five focus-mode values. */
export const FOCUS_RAMP = ['#efe6d3', '#d8c9a8', '#b9a77f', '#97865e', '#776844'];

export const INK = {
  primary: '#e6edf7',
  secondary: '#a3b1c6',
  muted: '#7d8ca3',
  grid: '#22324d',
  strong: '#2c3f5f',
  ground: '#0b1220',
} as const;

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const axisProps = {
  stroke: INK.strong,
  tick: { fill: INK.secondary, fontSize: 12, fontFamily: MONO },
  tickLine: false,
} as const;

export const gridProps = {
  stroke: INK.grid,
  strokeDasharray: '2 4',
  vertical: false,
} as const;

export const tooltipProps = {
  contentStyle: {
    background: '#1a2942',
    border: `1px solid ${INK.strong}`,
    borderRadius: 8,
    color: INK.primary,
    fontSize: 13,
  },
  labelStyle: { color: INK.secondary, marginBottom: 4 },
  itemStyle: { color: INK.primary, padding: 0, fontFamily: MONO },
  cursor: { stroke: INK.muted, strokeDasharray: '3 3' },
} as const;

/** Round tick values (1/2/5 × 10^n steps) spanning [min, max], always including 0. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const ticks: number[] = [];
  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  for (let i = 0; first + i * step <= last + step * 0.001 && i < 50; i++) ticks.push(Math.round(first + i * step));
  return ticks;
}

export function yearTicks(lastYear: number): number[] {
  const step = lastYear > 20 ? 5 : lastYear > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = 0; y <= lastYear; y += step) ticks.push(y);
  return ticks;
}
