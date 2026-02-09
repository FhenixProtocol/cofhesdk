import { cn } from '../../../utils/cn.js';
import type { ReactNode } from 'react';

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  className?: string;
  variant?: 'default' | 'tab';
  pressed?: boolean;
}

/**
 * Reusable action button styled like the bottom navigation buttons with sharp edges.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  disabled = false,
  icon,
  label,
  className,
  variant = 'default',
  pressed = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full font-medium flex items-center justify-center gap-1',
        variant === 'tab' ? 'py-2 px-2 text-sm' : 'py-1.5 px-2 text-xs',
        'fnx-nav-button',
        pressed && 'fnx-nav-button-active',
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
