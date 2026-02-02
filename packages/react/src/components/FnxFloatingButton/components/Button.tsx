import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'default' | 'error' | 'warning' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant style */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Text content (alternative to children) */
  label?: string;
  /** Icon component to display */
  icon?: ReactNode;
  /** Icon position relative to text */
  iconPosition?: 'left' | 'right' | 'top';
  /** Override default className */
  className?: string;
  /** Button content (alternative to text prop) */
  children?: ReactNode;
}

/**
 * Reusable button component with support for light/dark mode, multiple variants, and sizes.
 *
 * @example
 * ```tsx
 * <Button variant="default" size="md" text="Sign" />
 * <Button variant="error" size="sm" text="Cancel" icon={<Icon />} />
 * <Button variant="outline" size="lg">
 *   Click me
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  label,
  icon,
  iconPosition = 'left',
  className,
  children,
  disabled,
  ...props
}) => {
  // Determine content - prefer text prop over children
  const content = label ?? children;

  // Determine if layout should be vertical
  const isVertical = iconPosition === 'top';

  // Base classes
  const baseClasses = cn(
    'inline-flex items-center justify-center',
    isVertical && 'flex-col',
    'font-medium',
    'border transition-all',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'transition-colors duration-200'
  );

  // Size classes - adjust gap for vertical layout
  const sizeClasses: Record<ButtonSize, string> = {
    sm: isVertical ? 'px-2 py-1 text-xs gap-1' : 'px-2 py-1 text-xs gap-1.5',
    md: isVertical ? 'px-3 py-1.5 text-xs gap-1' : 'px-3 py-1.5 text-xs gap-1.5',
    lg: isVertical ? 'px-4 py-2 text-sm gap-1.5' : 'px-4 py-2 text-sm gap-2',
    // xl: isVertical ? 'px-6 py-3 text-base gap-2' : 'px-6 py-3 text-base gap-2.5',
  };

  // Variant classes for light mode
  const variantClassesLight: Record<ButtonVariant, string> = {
    primary: cn('bg-[#80E6E6] hover:bg-[#6DD5D5]', 'text-[#003366]', 'border-[#666666]', 'focus:ring-[#80E6E6]'),
    default: cn(
      'bg-white hover:bg-[#6DD5D5]',
      'text-[#003366]',
      'border-[#666666]',
      'hover:border-[#4A4A4A]',
      'focus:ring-gray-300'
    ),
    error: cn('bg-[#FFB399] hover:bg-[#FF9F80]', 'text-[#003366]', 'border-[#666666]', 'focus:ring-[#FFB399]'),
    warning: cn('bg-[#FFD699] hover:bg-[#FFC966]', 'text-[#003366]', 'border-[#666666]', 'focus:ring-[#FFD699]'),
    ghost: cn('bg-transparent hover:bg-gray-100', 'text-[#003366]', 'border-transparent', 'focus:ring-gray-300'),
    outline: cn(
      'bg-white hover:bg-gray-50',
      'text-[#003366]',
      'border-[#666666]',
      'hover:border-[#4A4A4A]',
      'focus:ring-gray-300'
    ),
  };

  // Variant classes for dark mode
  const variantClassesDark: Record<ButtonVariant, string> = {
    primary: cn(
      'dark:bg-[#2E9D9D] dark:hover:bg-[#268585]',
      'dark:text-white',
      'dark:border-[##858585]',
      'dark:focus:ring-[#2E9D9D]'
    ),
    default: cn(
      'dark:bg-[#595959] dark:hover:bg-[#268585]',
      'dark:text-white',
      'dark:border-[##858585]',
      'dark:hover:border-[#9E9E9E]',
      'dark:focus:ring-gray-600'
    ),
    error: cn(
      'dark:bg-[#D9532E] dark:hover:bg-[#C0441F]',
      'dark:text-white',
      'dark:border-[##858585]',
      'dark:focus:ring-[#D9532E]'
    ),
    warning: cn(
      'dark:bg-[#E67E22] dark:hover:bg-[#D35400]',
      'dark:text-white',
      'dark:border-[##858585]',
      'dark:focus:ring-[#E67E22]'
    ),
    ghost: cn(
      'dark:bg-transparent dark:hover:bg-[#374151]',
      'dark:text-white',
      'dark:border-transparent',
      'dark:focus:ring-gray-600'
    ),
    outline: cn(
      'dark:bg-[#595959] dark:hover:bg-[#4A4A4A]',
      'dark:text-white',
      'dark:border-[##858585]',
      'dark:hover:border-[#9E9E9E]',
      'dark:focus:ring-gray-600'
    ),
  };

  // Combine all classes
  const buttonClasses = cn(
    baseClasses,
    sizeClasses[size],
    variantClassesLight[variant],
    variantClassesDark[variant],
    className
  );

  // Icon wrapper classes - flex container that doesn't constrain icon size
  const iconWrapperClasses = 'flex items-center justify-center flex-shrink-0';

  return (
    <button className={buttonClasses} disabled={disabled} {...props}>
      {icon && iconPosition === 'top' && <span className={iconWrapperClasses}>{icon}</span>}
      {icon && iconPosition === 'left' && <span className={iconWrapperClasses}>{icon}</span>}
      {content}
      {icon && iconPosition === 'right' && <span className={iconWrapperClasses}>{icon}</span>}
    </button>
  );
};
