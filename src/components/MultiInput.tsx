import type { ReactNode } from 'react';
import type { ScenarioValue } from '../types';
import type { InputFormat } from '../utils/format';
import { AdornedInput, FocusModeButton } from './InputField';

interface MultiInputProps {
  label: string;
  value: ScenarioValue;
  onChange: (value: ScenarioValue) => void;
  helpText?: ReactNode;
  format?: InputFormat;
  onFocusMode?: () => void;
  focusActive?: boolean;
}

const SCENARIOS: { key: keyof ScenarioValue; label: string }[] = [
  { key: 'pessimistic', label: 'Pessimistic' },
  { key: 'baseline', label: 'Baseline' },
  { key: 'optimistic', label: 'Optimistic' },
];

export default function MultiInput({
  label,
  value,
  onChange,
  helpText,
  format = 'percent',
  onFocusMode,
  focusActive,
}: MultiInputProps) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <legend className="float-left p-0 text-[13px] text-ink-2">{label}</legend>
        {onFocusMode && <FocusModeButton onClick={onFocusMode} active={focusActive} label={label} />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SCENARIOS.map(({ key, label: scenarioLabel }) => (
          <label key={key} className="flex min-w-0 flex-col gap-1">
            <span className={`text-[11px] ${key === 'baseline' ? 'text-ink' : 'text-muted'}`}>{scenarioLabel}</span>
            <AdornedInput
              value={value[key]}
              onChange={(v) => onChange({ ...value, [key]: v })}
              format={format}
              ariaLabel={`${label}, ${scenarioLabel.toLowerCase()}`}
              emphasis={key === 'baseline'}
            />
          </label>
        ))}
      </div>
      {helpText && <span className="text-xs leading-snug text-muted">{helpText}</span>}
    </fieldset>
  );
}
