import { cn } from '../../../utils/cn.js';

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: string;
  className?: string;
}

/**
 * Reusable action button styled like the bottom navigation buttons with sharp edges.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({ onClick, disabled = false, icon, label, className }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full py-1.5 px-2 text-xs font-medium flex items-center justify-center gap-1',
        'fnx-nav-button',
        'transition-all',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
