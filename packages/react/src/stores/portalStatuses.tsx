import type { CofheFloatingButtonInternalStatus } from '@/components/CofheFloatingButton/internalTypes';
import type { CofheStatus } from '@/components/CofheFloatingButton/types';
import { create } from 'zustand';

type PortalStatusesStore = {
  statuses: CofheFloatingButtonInternalStatus[];
};

type PortalStatusesActions = {
  /**
   * Public-safe status entry point.
   *
   * Callers must provide the consumer-facing intent-based action shape here.
   */
  addStatus: (status: CofheStatus) => void;
  /**
   * Internal-only status entry point for widget-local callback actions.
   */
  addInternalStatus: (status: CofheFloatingButtonInternalStatus) => void;
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
  addInternalStatus: (status) => {
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
