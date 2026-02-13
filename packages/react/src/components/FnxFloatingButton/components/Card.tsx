import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, padded = true }) => {
  return (
    <div className={cn('fnx-card-bg rounded-lg border fnx-card-border', padded && 'p-4', className)}>{children}</div>
  );
};
