import { isValidElement, cloneElement, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import type { FnxFloatingButtonToast } from './types';
import { cn } from '@/utils';

interface ToastsSectionProps {
  className?: string;
}

const ToastClearer = ({
  id,
  paused,
  remainingMs,
}: {
  id: string;
  paused: boolean;
  remainingMs: number;
}) => {
  const { removeToast } = useFnxFloatingButtonContext();


  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (remainingMs <= 0) {
      removeToast(id);
      return;
    }

    if (!paused) {
      timerRef.current = setTimeout(() => removeToast(id), remainingMs);
    }

    if (paused) {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [remainingMs, paused]);

  return null;
};

const ToastComponent: React.FC<FnxFloatingButtonToast> = ({ id, duration, paused, startMs, remainingMs, content }) => {
  const { isTopSide } = useFnxFloatingButtonContext();

  // Inject id and paused into content if it's a React element
  const injectedContent = isValidElement(content)
    ? cloneElement(content, { id, paused, startMs, remainingMs, ...content.props })
    : content;

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: isTopSide ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: isTopSide ? 4 : -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('min-h-8 bg-white border items-center justify-start w-full max-w-full')}
    >
      {injectedContent}
      {duration != 'infinite' && (
        <ToastClearer id={id} paused={paused} remainingMs={remainingMs} />
      )}
    </motion.div>
  );
};

export const ToastsSection: React.FC<ToastsSectionProps> = ({ className }) => {
  const { toasts } = useFnxFloatingButtonContext();
  return (
    <div className={cn('fnx-toasts-section flex flex-col gap-3', className)}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};
