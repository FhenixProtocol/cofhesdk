import { create } from 'zustand';
import { FloatingButtonPage, type FloatingButtonPagePropsMap } from '../pagesConfig/types';

interface OpenRequest {
  page: FloatingButtonPage;
  props?: FloatingButtonPagePropsMap[FloatingButtonPage];
  timestamp: number;
}

interface OpenButtonState {
  /** Pending open request from external trigger */
  pendingOpen: OpenRequest | null;

  /** Request to open the button to a specific page */
  requestOpen: (page: FloatingButtonPage, props?: FloatingButtonPagePropsMap[FloatingButtonPage]) => void;

  /** Clear the pending open request (called after handling) */
  clearPendingOpen: () => void;
}

export const useOpenButtonStore = create<OpenButtonState>()((set) => ({
  pendingOpen: null,

  requestOpen: (page, props) =>
    set({
      pendingOpen: { page, props, timestamp: Date.now() },
    }),

  clearPendingOpen: () => set({ pendingOpen: null }),
}));
