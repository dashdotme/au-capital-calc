import { useState } from 'react';

export interface ScenarioValue {
  pessimistic: number;
  baseline: number;
  optimistic: number;
}

interface MultiInputProps {
  label: string;
  value: ScenarioValue;
  onChange: (value: ScenarioValue) => void;
  helpText?: string;
  onFocusMode?: () => void;
}

export default function MultiInput({
  label,
  value,
  onChange,
  helpText,
  onFocusMode,
}: MultiInputProps) {
  const [displayValues, setDisplayValues] = useState({
    pessimistic: value.pessimistic.toString(),
    baseline: value.baseline.toString(),
    optimistic: value.optimistic.toString(),
  });

  const handleChange = (
    scenario: keyof ScenarioValue,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = e.target.value;
    setDisplayValues({ ...displayValues, [scenario]: newValue });

    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange({ ...value, [scenario]: numValue });
    } else if (newValue === '' || newValue === '-') {
      onChange({ ...value, [scenario]: 0 });
    }
  };

  const handleBlur = (scenario: keyof ScenarioValue) => {
    setDisplayValues({
      ...displayValues,
      [scenario]: value[scenario].toString(),
    });
  };

  return (
    <label className="block mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {label}
        </span>
        {onFocusMode && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onFocusMode();
            }}
            className="text-text-secondary hover:text-accent transition-colors"
            title="Focus Mode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="text-xs text-[var(--color-text-secondary)] opacity-70 block mb-1">
            Pessimistic
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={displayValues.pessimistic}
            onChange={(e) => handleChange('pessimistic', e)}
            onBlur={() => handleBlur('pessimistic')}
            onFocus={(e) => e.target.select()}
            className="input-field text-sm"
          />
        </div>
        <div>
          <span className="text-xs text-[var(--color-text-secondary)] opacity-70 block mb-1">
            Baseline
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={displayValues.baseline}
            onChange={(e) => handleChange('baseline', e)}
            onBlur={() => handleBlur('baseline')}
            onFocus={(e) => e.target.select()}
            className="input-field text-sm"
          />
        </div>
        <div>
          <span className="text-xs text-[var(--color-text-secondary)] opacity-70 block mb-1">
            Optimistic
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={displayValues.optimistic}
            onChange={(e) => handleChange('optimistic', e)}
            onBlur={() => handleBlur('optimistic')}
            onFocus={(e) => e.target.select()}
            className="input-field text-sm"
          />
        </div>
      </div>
      {helpText && (
        <span className="text-xs mt-1 block text-[var(--color-text-secondary)] opacity-70">
          {helpText}
        </span>
      )}
    </label>
  );
}
