import { useRef, useState } from 'react';
import { formatCompactValue } from '../utils/focusRanges';
import { FOCUS_RAMP } from './chartTheme';

interface FocusSliderProps {
  values: number[];
  onChange: (values: number[]) => void;
  unit: string;
  min?: number;
  max?: number;
  label: string;
}

/** Five ordered handles on one track; pointer events so it works with touch too. */
export default function FocusSlider({ values, onChange, unit, min = 0, max = 15, label }: FocusSliderProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const step = unit === '$' ? 50 : 0.05;

  const position = (value: number) => ((value - min) / (max - min)) * 100;

  const setValue = (index: number, raw: number) => {
    const next = [...values];
    const lower = index > 0 ? values[index - 1] : min;
    const upper = index < values.length - 1 ? values[index + 1] : max;
    next[index] = Math.round(Math.min(upper, Math.max(lower, raw)) / step) * step;
    onChange(next);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (dragging === null || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setValue(dragging, min + fraction * (max - min));
  };

  return (
    <div className="px-3 pt-2 pb-1">
      <div
        ref={trackRef}
        className="relative h-1.5 rounded-full bg-line"
        onPointerMove={handleMove}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        {values.map((value, index) => (
          <div
            key={index}
            role="slider"
            tabIndex={0}
            aria-label={`${label}, value ${index + 1} of ${values.length}`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={formatCompactValue(value, unit)}
            onPointerDown={(e) => {
              e.currentTarget.parentElement?.setPointerCapture(e.pointerId);
              setDragging(index);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setValue(index, value - step);
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setValue(index, value + step);
            }}
            style={{ left: `${position(value)}%`, backgroundColor: FOCUS_RAMP[index] }}
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-ground shadow active:cursor-grabbing"
          />
        ))}
      </div>
      <div className="relative mt-2 h-9 font-mono text-xs text-ink-2">
        {values.map((value, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${position(value)}%`, top: index % 2 ? 18 : 0 }}
          >
            {formatCompactValue(value, unit)}
          </span>
        ))}
      </div>
    </div>
  );
}
