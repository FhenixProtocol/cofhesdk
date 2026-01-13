import { ToastPrimitive } from '@/components/FnxFloatingButton/components/ToastPrimitives';
import { FNX_DEFAULT_TOAST_DURATION } from '@/components/FnxFloatingButton/FnxFloatingButtonContext';
import type {
  OpenPortalModalFn,
  PortalModal,
  PortalModalPropsMap,
  PortalModalState,
} from '@/components/FnxFloatingButton/modals/types';
import {
  FloatingButtonPage,
  type FloatingButtonPagePropsMap,
  type PageState,
  type PagesWithProps,
} from '@/components/FnxFloatingButton/pagesConfig/types';
import type { FnxFloatingButtonToast, FnxStatus, FnxToastImperativeParams } from '@/components/FnxFloatingButton/types';
import { isValidElement, useMemo } from 'react';
import { create } from 'zustand';

const ANIM_DURATION = 300;

export type NavigateParams = {
  // When true, do not append to history; override current page instead
  skipPagesHistory?: boolean;
};

export type NavigateArgs<K extends FloatingButtonPage> = {
  pageProps?: FloatingButtonPagePropsMap[K];
  navigateParams?: NavigateParams;
};

type NavigateToFn = <K extends FloatingButtonPage>(
  ...args: K extends PagesWithProps ? [page: K, props: NavigateArgs<K>] : [page: K, props?: NavigateArgs<K>]
) => void;

type PortalStore = {
  pageHistory: PageState[];
  overridingPage: PageState | null;

  portalOpen: boolean;
  statusPanelOpen: boolean;
  contentPanelOpen: boolean;

  toasts: FnxFloatingButtonToast[];
  statuses: FnxStatus[];
  contentHeights: Array<{ id: string; height: number }>;

  modalStack: PortalModalState[];
};

type PortalActions = {
  navigateTo: NavigateToFn;
  navigateBack: () => void;
  openPortal: () => void;
  closePortal: () => void;
  togglePortal: (externalOnClick?: () => void) => void;

  addToast: (toast: React.ReactNode | FnxToastImperativeParams, duration?: number | 'infinite') => void;
  pauseToast: (id: string, paused: boolean) => void;
  removeToast: (id: string) => void;

  addStatus: (status: FnxStatus) => void;
  removeStatus: (id: string) => void;

  setContentHeight: (id: string, height: number) => void;
  removeContentHeight: (id: string) => void;

  openTimeoutId: ReturnType<typeof setTimeout> | null;
  closeTimeoutId: ReturnType<typeof setTimeout> | null;
  clearTimeouts: () => void;
  openModal: OpenPortalModalFn;
  closeModal: (modal: PortalModal) => void;
};

export const usePortalStore = create<PortalStore & PortalActions>()((set, get) => ({
  pageHistory: [{ page: FloatingButtonPage.Main }],
  overridingPage: null,

  portalOpen: false,
  statusPanelOpen: false,
  contentPanelOpen: false,

  toasts: [],
  statuses: [],
  contentHeights: [],

  modalStack: [],

  // Actions

  navigateTo: <K extends FloatingButtonPage>(
    ...args: K extends PagesWithProps ? [page: K, props: NavigateArgs<K>] : [page: K, props?: NavigateArgs<K>]
  ) => {
    const [page, props] = args;
    const skipPagesHistory = props?.navigateParams?.skipPagesHistory === true;
    if (skipPagesHistory) {
      set({ overridingPage: { page, props } as PageState });
    } else {
      const existing = get().pageHistory;
      const updated = [...existing, { page, props } as PageState];
      set({ pageHistory: updated });
    }
  },
  navigateBack: () => set({ pageHistory: get().pageHistory.slice(0, -1) }),

  openTimeoutId: null,
  closeTimeoutId: null,
  clearTimeouts: () => {
    const { openTimeoutId, closeTimeoutId } = get();
    if (openTimeoutId) clearTimeout(openTimeoutId);
    if (closeTimeoutId) clearTimeout(closeTimeoutId);
    set({ openTimeoutId: null, closeTimeoutId: null });
  },
  openPortal: () => {
    const { closeTimeoutId, statusPanelOpen, statuses } = get();

    // Open portal
    set({ portalOpen: true });

    // Cancel closing timeout
    if (closeTimeoutId) {
      clearTimeout(closeTimeoutId);
      set({ closeTimeoutId: null });
    }

    // Open status panel immediately
    set({ statusPanelOpen: true });

    if (statusPanelOpen || statuses.length > 0) {
      // Open content immediately if status panel visible or statuses exist
      set({ contentPanelOpen: true });
    } else {
      // Open content after delay
      const id = setTimeout(() => {
        set({ contentPanelOpen: true, openTimeoutId: null });
      }, ANIM_DURATION);

      set({ openTimeoutId: id });
    }
  },
  closePortal: () => {
    const { openTimeoutId } = get();

    // Close portal
    set({ portalOpen: false });

    // Cancel opening timeout
    if (openTimeoutId) {
      clearTimeout(openTimeoutId);
      set({ openTimeoutId: null });
    }

    // Close content immediately
    set({ contentPanelOpen: false });

    // Close status panel after delay
    const id = setTimeout(() => {
      set({ statusPanelOpen: false, closeTimeoutId: null });
    }, ANIM_DURATION);

    set({ closeTimeoutId: id });
  },
  togglePortal: () => {
    get().portalOpen ? get().closePortal() : get().openPortal();
  },

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

  addStatus: (status) => {
    const existing = get().statuses;
    set({ statuses: [...existing, status] });
  },
  removeStatus: (id) => {
    const existing = get().statuses;
    set({ statuses: existing.filter((s) => s.id !== id) });
  },

  setContentHeight: (id, height) => {
    const existing = get().contentHeights;
    const updated = [...existing.filter((h) => h.id !== id), { id, height }];
    set({ contentHeights: updated });
  },
  removeContentHeight: (id) => {
    set({ contentHeights: get().contentHeights.filter((height) => height.id !== id) });
  },

  openModal: <M extends PortalModal>(
    ...args: PortalModalPropsMap[M] extends void ? [modal: M] : [modal: M, props: PortalModalPropsMap[M]]
  ) => {
    const [modal, props] = args;
    const onClose = () => get().closeModal(modal);
    const modalState = { modal, onClose, ...(props ?? {}) } as PortalModalState;
    set({ modalStack: [...get().modalStack, modalState] });
  },
  closeModal: (modal) => {
    set({ modalStack: get().modalStack.filter((m) => m.modal !== modal) });
  },
}));

export const usePortalCurrentPage = () => {
  const { overridingPage, pageHistory } = usePortalStore();
  return overridingPage ?? pageHistory[pageHistory.length - 1];
};

export const usePortalMaxContentHeight = () => {
  const { contentHeights } = usePortalStore();
  return useMemo(() => {
    return contentHeights.reduce((max, height) => Math.max(max, height.height), 0);
  }, [contentHeights]);
};
