import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface PermitSelectionContextValue {
  selectedPermitId?: string;
  selectPermit: (permitId: string) => void;
  clearSelection: () => void;
}

const PermitSelectionContext = createContext<PermitSelectionContextValue | undefined>(undefined);

export const PermitSelectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedPermitId, setSelectedPermitId] = useState<string | undefined>();

  const value = useMemo(
    () => ({
      selectedPermitId,
      selectPermit: setSelectedPermitId,
      clearSelection: () => setSelectedPermitId(undefined),
    }),
    [selectedPermitId]
  );

  return <PermitSelectionContext.Provider value={value}>{children}</PermitSelectionContext.Provider>;
};

export const usePermitSelection = (): PermitSelectionContextValue => {
  const ctx = useContext(PermitSelectionContext);
  if (!ctx) {
    throw new Error('usePermitSelection must be used within PermitSelectionProvider');
  }
  return ctx;
};
