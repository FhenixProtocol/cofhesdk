import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { usePortalUI, usePortalStatuses } from '@/stores';

export const StatusBarSection: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { isLeftSide } = useFnxFloatingButtonContext();
  const { statuses } = usePortalStatuses();
  const { statusPanelOpen } = usePortalUI();

  return (
    <AnimatePresence>
      {(statusPanelOpen || statuses.length > 0) && (
        <motion.div
          className="relative flex flex-1 h-12 items-center justify-between"
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
