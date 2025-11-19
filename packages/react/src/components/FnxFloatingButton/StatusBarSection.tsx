import type { ReactNode } from 'react';
import { cn } from '../../utils/cn.js';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext.js';

interface StatusBarSectionProps {
  className?: string;
  isExpanded: boolean;
  isLeftSide: boolean;
  children?: ReactNode;
}

export const StatusBarSection: React.FC<StatusBarSectionProps> = ({
  className,
  isExpanded,
  isLeftSide,
  children,
}) => {
  const { darkMode } = useFnxFloatingButtonContext();
  
  return (
    <div
      className={cn(className, 'fnx-status-bar-container flex')}
      data-left={isLeftSide}
      data-expanded={isExpanded}
    >
      <div
        className={cn(
          'fnx-status-bar fnx-glow flex items-center',
          darkMode && 'dark'
        )}
        data-expanded={isExpanded}
        data-left={isLeftSide}
      >
        <div className="flex items-center justify-between w-full px-4">
          {children}
        </div>
      </div>
    </div>
  );
};

