import { isValidElement, cloneElement, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import type { FnxFloatingButtonToast } from './types';
import { cn } from '@/utils';
import { usePortalToasts } from '@/stores';

const ToastClearer = ({ id, paused, remainingMs }: { id: string; paused: boolean; remainingMs: number }) => {
  const { removeToast } = usePortalToasts();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (remainingMs <= 0) {
      removeToast(id);
      return;
    }

    // Clear the timer if the toast has been paused
    if (paused && timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Start the timer if the toast has been unpaused
    if (!paused) {
      timerRef.current = setTimeout(() => removeToast(id), remainingMs);
    }

    return () => {
      if (timerRef.current == null) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, paused]);

  return null;
};

const ToastComponent: React.FC<FnxFloatingButtonToast> = ({ id, duration, paused, startMs, remainingMs, content }) => {
  const { isTopSide } = useFnxFloatingButtonContext();
  const { pauseToast, removeToast } = usePortalToasts();

  const handlePause = (paused: boolean) => {
    pauseToast(id, paused);
  };

  const handleDismiss = () => {
    removeToast(id);
  };

  // Inject id and paused into content if it's a React element
  const injectedContent = isValidElement(content)
    ? cloneElement(content, {
        id,
        paused,
        startMs,
        remainingMs,
        duration,
        onPause: handlePause,
        onDismiss: handleDismiss,
        ...content.props,
      })
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
      {duration != 'infinite' && <ToastClearer id={id} paused={paused} remainingMs={remainingMs} />}
    </motion.div>
  );
};

export const ToastsSection: React.FC = () => {
  const { toasts } = usePortalToasts();
  return (
    <div className="flex flex-col gap-3 w-full max-w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};
