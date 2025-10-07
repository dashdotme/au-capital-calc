import { useState } from 'react';

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helpText?: string;
  onFocusMode?: () => void;
}

export default function InputField({
  label,
  value,
  onChange,
  helpText,
  onFocusMode,
}: InputFieldProps) {
  const [displayValue, setDisplayValue] = useState(value.toString());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);

    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    } else if (newValue === '' || newValue === '-') {
      onChange(0);
    }
  };

  const handleBlur = () => {
    setDisplayValue(value.toString());
  };

  return (
    <label className="block mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
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
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
        className="input-field"
      />
      {helpText && (
        <span className="text-xs mt-1 block text-[var(--color-text-secondary)] opacity-70">
          {helpText}
        </span>
      )}
    </label>
  );
}
