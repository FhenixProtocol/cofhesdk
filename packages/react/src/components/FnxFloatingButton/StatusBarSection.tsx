import { useMemo, type ReactNode } from 'react';
import { cn } from '@/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';

export const StatusBarSection: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { statusPanelOpen, statuses, isLeftSide } = useFnxFloatingButtonContext();
  const topStatusVariant = useMemo(() => {
    return statuses[statuses.length - 1]?.variant;
  }, [statuses]);
  return (
    <AnimatePresence>
      {(statusPanelOpen || statuses.length > 0) && (
        <motion.div
          className={cn(
            'relative flex flex-1 h-12 items-center justify-between',
            topStatusVariant === 'error' && 'border-red-500',
            topStatusVariant === 'warning' && 'border-yellow-500'
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
