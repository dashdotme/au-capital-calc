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
}

export default function MultiInput({
  label,
  value,
  onChange,
  helpText,
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
      <span className="text-sm block mb-1 text-[var(--color-text-secondary)]">
        {label}
      </span>
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
