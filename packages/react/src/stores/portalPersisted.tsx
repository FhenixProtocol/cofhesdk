// Persisted store for long running flags / settings / etc

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PortalPersistedStore = {
  hasCreatedFirstACP: boolean;
};

type PortalPersistedActions = {
  setHasCreatedFirstACP: (hasCreated: boolean) => void;
};

export const usePortalPersisted = create<PortalPersistedStore & PortalPersistedActions>()(
  persist(
    (set, get) => ({
      hasCreatedFirstACP: false,

      setHasCreatedFirstACP: (hasCreated) => set({ hasCreatedFirstACP: hasCreated }),
    }),
    {
      name: 'cofhesdk-react-persisted',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
