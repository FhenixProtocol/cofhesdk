import { cn } from '../../../utils/cn.js';

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return <div className={cn('fnx-card-bg p-3 border fnx-card-border', className)}>{children}</div>;
};
