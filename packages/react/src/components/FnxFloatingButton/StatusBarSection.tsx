import type { ReactNode } from 'react';
import { cn } from '../../utils/cn.js';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext.js';

export const StatusBarSection: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { theme, isExpanded, isLeftSide } = useFnxFloatingButtonContext();
  const darkMode = theme === 'dark';

  return (
    <div className="fnx-status-bar-container flex" data-left={isLeftSide} data-expanded={isExpanded}>
      <div
        className={cn('fnx-status-bar flex items-center', darkMode && 'dark')}
        data-expanded={isExpanded}
        data-left={isLeftSide}
      >
        <div className="flex items-center justify-between w-full px-4">{children}</div>
      </div>
    </div>
  );
};
