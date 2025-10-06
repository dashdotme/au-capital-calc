import { useState } from 'react';

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helpText?: string;
}

export default function InputField({
  label,
  value,
  onChange,
  helpText,
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
      <span className="text-sm block mb-1 text-[var(--color-text-secondary)]">{label}</span>
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
