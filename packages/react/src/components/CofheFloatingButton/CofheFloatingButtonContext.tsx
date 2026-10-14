import { type ReactNode, createContext, useContext } from 'react';
import type { FloatingButtonPosition } from './types';
import { useCofheContext } from '../../providers';
import { useTrackPendingTransactions } from '@/hooks/useTrackPendingTransactions';
import { useWatchACPStatus } from '@/hooks/useWatchACPStatus';
import { useWatchClaimablesStatus } from '@/hooks/useWatchClaimablesStatus';

export type TokenListMode = 'view' | 'select';

interface CofheFloatingButtonContextValue {
  theme: 'dark' | 'light';
  effectivePosition: FloatingButtonPosition;
  isLeftSide: boolean;
  isTopSide: boolean;
}

const CofheFloatingButtonContext = createContext<CofheFloatingButtonContextValue | null>(null);

interface CofheFloatingButtonProviderProps {
  children?: ReactNode;
}

export const CofheFloatingButtonProvider: React.FC<CofheFloatingButtonProviderProps> = ({ children }) => {
  const { state } = useCofheContext();

  const theme = state.theme;
  const effectivePosition = state.position;
  const isLeftSide = effectivePosition.includes('left');
  const isTopSide = effectivePosition.includes('top');

  useTrackPendingTransactions();
  useWatchACPStatus();
  useWatchClaimablesStatus();

  return (
    <CofheFloatingButtonContext.Provider
      value={{
        theme,
        effectivePosition,
        isLeftSide,
        isTopSide,
      }}
    >
      {children}
    </CofheFloatingButtonContext.Provider>
  );
};

export const useCofheFloatingButtonContext = (): CofheFloatingButtonContextValue => {
  const context = useContext(CofheFloatingButtonContext);
  if (!context) {
    throw new Error('useCofheFloatingButtonContext must be used within CofheFloatingButtonProvider');
  }
  return context;
};
