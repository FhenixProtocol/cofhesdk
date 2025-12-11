import { sanitizeNumericInput } from '../../../utils/utils.js';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  onMaxClick: () => void;
  placeholder?: string;
  className?: string;
}

/**
 * Reusable amount input with max button for token operations.
 */
export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  onMaxClick,
  placeholder = '0',
  className,
}) => {
  return (
    <div className={`flex items-center gap-1 w-full ${className ?? ''}`}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(sanitizeNumericInput(e.target.value))}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-sm font-medium fnx-text-primary outline-none placeholder:opacity-50 text-center border-b fnx-card-border pb-1"
      />
      <button onClick={onMaxClick} className="fnx-max-button text-xxxs font-medium px-1 py-0.5 rounded flex-shrink-0">
        max
      </button>
    </div>
  );
};
