import type { CofheFloatingButtonInternalStatus } from '@/components/CofheFloatingButton/internalTypes';
import { create } from 'zustand';

type PortalStatusesStore = {
  statuses: CofheFloatingButtonInternalStatus[];
};

type PortalStatusesActions = {
  /**
   * Internal widget entry point for statuses.
   * Public consumers should observe statuses through useCofheStatuses, which
   * narrows actions to the intent-based public shape.
   */
  addStatus: (status: CofheFloatingButtonInternalStatus) => void;
  removeStatus: (id: string) => void;
  hasStatus: (id: string) => boolean;
};

export const usePortalStatuses = create<PortalStatusesStore & PortalStatusesActions>()((set, get) => ({
  statuses: [],
  addStatus: (status) => {
    // avoid duplicates
    if (get().hasStatus(status.id)) return;

    const existing = get().statuses;
    set({ statuses: [...existing, status] });
  },
  removeStatus: (id) => {
    const existing = get().statuses;
    set({ statuses: existing.filter((s) => s.id !== id) });
  },
  hasStatus: (id) => {
    return get().statuses.some((s) => s.id === id);
  },
}));
