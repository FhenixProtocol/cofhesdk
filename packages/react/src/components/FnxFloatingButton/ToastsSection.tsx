import { cn } from '../../utils/cn';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import type { FnxFloatingButtonToast } from './types';

interface ToastsSectionProps {
  className?: string;
}

const ToastComponent: React.FC<FnxFloatingButtonToast> = ({ id, duration, content }) => {
  const { removeToast, isTopSide } = useFnxFloatingButtonContext();

  useEffect(() => {
    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [duration, id, removeToast]);

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: isTopSide ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: isTopSide ? 4 : -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('min-h-8 bg-white border items-center justify-start')}
    >
      {content}
    </motion.div>
  );
};

export const ToastsSection: React.FC<ToastsSectionProps> = ({ className }) => {
  const { toasts } = useFnxFloatingButtonContext();
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};
