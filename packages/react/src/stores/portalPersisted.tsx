// Persisted store for long running flags / settings / etc

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PortalPersistedStore = {
  hasCreatedFirstPermit: boolean;
};

type PortalPersistedActions = {
  setHasCreatedFirstPermit: (hasCreated: boolean) => void;
};

export const usePortalPersisted = create<PortalPersistedStore & PortalPersistedActions>()(
  persist(
    (set, get) => ({
      hasCreatedFirstPermit: false,

      setHasCreatedFirstPermit: (hasCreated) => set({ hasCreatedFirstPermit: hasCreated }),
    }),
    {
      name: 'cofhesdk-react-persisted',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
