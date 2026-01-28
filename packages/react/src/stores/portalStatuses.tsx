import type { FnxStatus } from '@/components/FnxFloatingButton/types';
import { create } from 'zustand';

type PortalStatusesStore = {
  statuses: FnxStatus[];
};

type PortalStatusesActions = {
  addStatus: (status: FnxStatus) => void;
  removeStatus: (id: string) => void;
  hasStatus: (id: string) => boolean;
};

export const usePortalStatuses = create<PortalStatusesStore & PortalStatusesActions>()((set, get) => ({
  statuses: [],
  hasStatus: (id) => {
    const existing = get().statuses;
    return existing.some((s) => s.id === id);
  },
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
