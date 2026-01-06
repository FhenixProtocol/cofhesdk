import type { ReactNode } from 'react';
import { cn } from '@/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';

export const StatusBarSection: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { statusPanelOpen, status, isLeftSide } = useFnxFloatingButtonContext();
  return (
    <AnimatePresence>
      {(statusPanelOpen || status != null) && (
        <motion.div
          className={cn(
            'relative flex flex-1 h-12 items-center justify-between',
            status != null && status.variant === 'error' && 'border-red-500',
            status != null && status.variant === 'warning' && 'border-yellow-500'
          )}
          initial={{ opacity: 0, x: isLeftSide ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isLeftSide ? -10 : 10 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
