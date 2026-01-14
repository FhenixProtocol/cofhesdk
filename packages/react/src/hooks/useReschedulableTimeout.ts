import { useEffect, useRef } from 'react';

/**
 * A reusable hook to schedule a timeout that can be rescheduled and safely cleaned up.
 * Useful for auto-clearing messages, debounced effects, or any delayed callback.
 */
export function useReschedulableTimeout(callback: () => void, defaultTimeout: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const schedule = (timeout?: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      callback();
    }, timeout ?? defaultTimeout);
  };

  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return { schedule, cancel };
}
