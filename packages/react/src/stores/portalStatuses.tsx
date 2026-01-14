import type { FnxStatus } from '@/components/FnxFloatingButton/types';
import { create } from 'zustand';

type PortalStatusesStore = {
  statuses: FnxStatus[];
};

type PortalStatusesActions = {
  addStatus: (status: FnxStatus) => void;
  removeStatus: (id: string) => void;
};

export const usePortalStatuses = create<PortalStatusesStore & PortalStatusesActions>()((set, get) => ({
  statuses: [],

  addStatus: (status) => {
    const existing = get().statuses;
    set({ statuses: [...existing, status] });
  },
  removeStatus: (id) => {
    const existing = get().statuses;
    set({ statuses: existing.filter((s) => s.id !== id) });
  },
}));
