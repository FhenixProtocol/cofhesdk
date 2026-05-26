import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import { button, iconWrapper } from './Button.css';

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
  const buttonClasses = cn(button({ size, variant, vertical: isVertical }), className);

  return (
    <button className={buttonClasses} disabled={disabled} {...props}>
      {icon && iconPosition === 'top' && <span className={iconWrapper}>{icon}</span>}
      {icon && iconPosition === 'left' && <span className={iconWrapper}>{icon}</span>}
      {content}
      {icon && iconPosition === 'right' && <span className={iconWrapper}>{icon}</span>}
    </button>
  );
};
