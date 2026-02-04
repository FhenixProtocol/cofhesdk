import { useMemo } from 'react';
import { create } from 'zustand';
import { usePortalStatuses } from './portalStatuses';

const ANIM_DURATION = 300;

type PortalUIStore = {
  portalOpen: boolean;
  statusPanelOpen: boolean;
  contentPanelOpen: boolean;
  contentHeights: Array<{ id: string; height: number }>;

  openTimeoutId: ReturnType<typeof setTimeout> | null;
  closeTimeoutId: ReturnType<typeof setTimeout> | null;
};

type OpenPortalArgs = {
  onOpenBegin?: () => void;
  onOpenEnd?: () => void;
};
type ClosePortalArgs = {
  onCloseBegin?: () => void;
  onCloseEnd?: () => void;
};
type TogglePortalArgs = OpenPortalArgs & ClosePortalArgs;

type PortalUIActions = {
  clearTimeouts: () => void;
  openPortal: (args?: OpenPortalArgs) => void;
  closePortal: (args?: ClosePortalArgs) => void;
  togglePortal: (args?: TogglePortalArgs) => void;

  setContentHeight: (id: string, height: number) => void;
  removeContentHeight: (id: string) => void;
};

export const usePortalUI = create<PortalUIStore & PortalUIActions>()((set, get) => ({
  portalOpen: false,
  statusPanelOpen: false,
  contentPanelOpen: false,
  contentHeights: [],

  openTimeoutId: null,
  closeTimeoutId: null,
  clearTimeouts: () => {
    const { openTimeoutId, closeTimeoutId } = get();
    if (openTimeoutId) clearTimeout(openTimeoutId);
    if (closeTimeoutId) clearTimeout(closeTimeoutId);
    set({ openTimeoutId: null, closeTimeoutId: null });
  },
  openPortal: (args = {}) => {
    const { onOpenBegin, onOpenEnd } = args;
    const { closeTimeoutId, statusPanelOpen } = get();

    
    // Open portal
    onOpenBegin?.();
    set({ portalOpen: true });

    // Cancel closing timeout
    if (closeTimeoutId) {
      clearTimeout(closeTimeoutId);
      set({ closeTimeoutId: null });
    }

    // Open status panel immediately
    set({ statusPanelOpen: true });

    const hasOpenStatus = usePortalStatuses.getState().statuses.length > 0;
    if (statusPanelOpen || hasOpenStatus) {
      // Open content immediately if status panel visible or statuses exist
      set({ contentPanelOpen: true });
      onOpenEnd?.();
    } else {
      // Open content after delay
      const id = setTimeout(() => {
        set({ contentPanelOpen: true, openTimeoutId: null });
        onOpenEnd?.();
      }, ANIM_DURATION);

      set({ openTimeoutId: id });
    }
  },
  closePortal: (args = {}) => {
    const { onCloseBegin, onCloseEnd } = args;
    const { openTimeoutId } = get();

    // Close portal
    onCloseBegin?.();
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
      onCloseEnd?.();
    }, ANIM_DURATION);

    set({ closeTimeoutId: id });
  },
  togglePortal: (args) => {
    get().portalOpen ? get().closePortal(args) : get().openPortal(args);
  },

  setContentHeight: (id, height) => {
    const existing = get().contentHeights;
    const updated = [...existing.filter((h) => h.id !== id), { id, height }];
    set({ contentHeights: updated });
  },
  removeContentHeight: (id) => {
    set({ contentHeights: get().contentHeights.filter((height) => height.id !== id) });
  },
}));

export const usePortalUIMaxContentHeight = () => {
  const { contentHeights } = usePortalUI();
  return useMemo(() => {
    return contentHeights.reduce((max, height) => Math.max(max, height.height), 0);
  }, [contentHeights]);
};
