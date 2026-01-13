import { ToastPrimitive } from '@/components/FnxFloatingButton/components/ToastPrimitives';
import { FNX_DEFAULT_TOAST_DURATION } from '@/components/FnxFloatingButton/FnxFloatingButtonContext';
import type { FnxFloatingButtonToast, FnxToastImperativeParams } from '@/components/FnxFloatingButton/types';
import { isValidElement } from 'react';
import { create } from 'zustand';

type PortalToastsStore = {
  toasts: FnxFloatingButtonToast[];
};

type PortalToastsActions = {
  addToast: (toast: React.ReactNode | FnxToastImperativeParams, duration?: number | 'infinite') => void;
  pauseToast: (id: string, paused: boolean) => void;
  removeToast: (id: string) => void;
};

export const usePortalToasts = create<PortalToastsStore & PortalToastsActions>()((set, get) => ({
  toasts: [],

  addToast: (toast, duration = FNX_DEFAULT_TOAST_DURATION) => {
    const content = isValidElement(toast) ? toast : <ToastPrimitive {...(toast as FnxToastImperativeParams)} />;
    const existing = get().toasts;
    const updated = [
      ...existing,
      {
        id: crypto.randomUUID(),
        duration,
        startMs: Date.now(),
        remainingMs: duration === 'infinite' ? Infinity : duration,
        paused: false,
        content,
      },
    ];
    set({ toasts: updated });
  },
  pauseToast: (id, paused) => {
    const existing = get().toasts;
    const updated = existing.map((t) => {
      if (t.id !== id) return t;
      if (t.paused === paused) return t;

      let remainingMs = t.remainingMs;
      let startMs = Date.now();
      if (paused) {
        const elapsedMs = Date.now() - t.startMs;
        remainingMs = Math.max(0, t.remainingMs - elapsedMs);
      }

      return { ...t, paused, startMs, remainingMs };
    });
    set({ toasts: updated });
  },
  removeToast: (id) => {
    const existing = get().toasts;
    set({ toasts: existing.filter((t) => t.id !== id) });
  },
}));
