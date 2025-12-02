import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useCopyFeedback
 * - Copies provided text to clipboard and exposes transient "copied" state per key.
 * - Useful for lists where each row has a copy action and needs quick feedback.
 */
export function useCopyFeedback(defaultDurationMs: number = 2000) {
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, number>>(new Map());

  const isCopied = useCallback((key: string) => copiedKeys.has(key), [copiedKeys]);

  const clearTimer = useCallback((key: string) => {
    const timers = timersRef.current;
    const existing = timers.get(key);
    if (existing) {
      window.clearTimeout(existing);
      timers.delete(key);
    }
  }, []);

  const copyWithFeedback = useCallback(
    async (key: string, text: string, durationMs?: number): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);

        setCopiedKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });

        clearTimer(key);
        const timeout = window.setTimeout(() => {
          setCopiedKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          timersRef.current.delete(key);
        }, durationMs ?? defaultDurationMs);
        timersRef.current.set(key, timeout);
        return true;
      } catch {
        return false;
      }
    },
    [clearTimer, defaultDurationMs]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const id of timersRef.current.values()) {
        window.clearTimeout(id);
      }
      timersRef.current.clear();
    };
  }, []);

  return { isCopied, copyWithFeedback };
}
