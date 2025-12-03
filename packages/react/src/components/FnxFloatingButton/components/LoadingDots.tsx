import { cn } from '../../../utils/cn.js';

export interface LoadingDotsProps {
  /** Size variant for the dots */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Custom className for the container */
  className?: string;
  /** Color variant - defaults to primary text color */
  variant?: 'primary' | 'secondary';
}

const sizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  size = 'md',
  className,
  variant = 'primary',
}) => {
  return (
    <span
      className={cn(
        'fnx-loading-dots',
        sizeClasses[size],
        variant === 'primary' ? 'fnx-text-primary' : 'opacity-70',
        className
      )}
    >
      <span>•</span>
      <span>•</span>
      <span>•</span>
    </span>
  );
};

