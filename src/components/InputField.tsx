import { useState, type ReactNode } from 'react';
import { formatInputValue, parseInputValue, type InputFormat } from '../utils/format';

const SUFFIX: Record<InputFormat, string> = { currency: '', percent: '%', years: 'yrs', number: '' };

export function FocusModeButton({ onClick, active, label }: { onClick: () => void; active?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`See how ${label.toLowerCase()} changes the result`}
      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
        active ? 'border-ink-2 bg-raised text-ink' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'
      }`}
    >
      {active ? 'Exploring' : 'Explore'}
    </button>
  );
}

/** Text input with $ / % / yrs adornments; shows thousands separators when not focused. */
export function AdornedInput({
  value,
  onChange,
  format = 'number',
  ariaLabel,
  emphasis,
}: {
  value: number;
  onChange: (value: number) => void;
  format?: InputFormat;
  ariaLabel: string;
  emphasis?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const suffix = SUFFIX[format];

  return (
    <div className="relative min-w-0">
      {format === 'currency' && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-2">$</span>
      )}
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={draft ?? formatInputValue(value, format)}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseInputValue(e.target.value);
          if (parsed !== null) onChange(parsed);
        }}
        onFocus={(e) => {
          setDraft(value.toString());
          const input = e.target;
          requestAnimationFrame(() => input.select());
        }}
        onBlur={() => setDraft(null)}
        className={`input-field tabular-nums ${format === 'currency' ? 'pl-6' : ''} ${suffix ? 'pr-9' : ''} ${
          emphasis ? 'border-ink-2!' : ''
        }`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>
      )}
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helpText?: ReactNode;
  format?: InputFormat;
  onFocusMode?: () => void;
  focusActive?: boolean;
}

export default function InputField({
  label,
  value,
  onChange,
  helpText,
  format = 'number',
  onFocusMode,
  focusActive,
}: InputFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="text-[13px] text-ink-2">{label}</span>
        {onFocusMode && <FocusModeButton onClick={onFocusMode} active={focusActive} label={label} />}
      </div>
      <AdornedInput value={value} onChange={onChange} format={format} ariaLabel={label} />
      {helpText && <span className="text-xs leading-snug text-muted">{helpText}</span>}
    </div>
  );
}
