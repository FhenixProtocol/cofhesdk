import type { ReactNode } from 'react';
import { cn } from '@/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';

export const StatusBarSection: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { statusPanelOpen, isLeftSide } = useFnxFloatingButtonContext();
  return (
    <AnimatePresence>
      {statusPanelOpen && (
        <motion.div
          className={cn('fnx-status-bar flex flex-1 h-12 items-center justify-between px-4')}
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
