import { useEffect, useRef } from 'react';

export function useTimeout() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (cb: () => void, delay: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(cb, delay);
  };

  const clear = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const isScheduled = () => timeoutRef.current != null;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return { set, clear, isScheduled };
}
