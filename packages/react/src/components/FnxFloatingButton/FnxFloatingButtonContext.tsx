import { type ReactNode, createContext, useContext } from 'react';
import type { FloatingButtonPosition } from './types';
import { useCofheContext } from '../../providers';
import { useTrackPendingTransactions } from '@/hooks/useTrackPendingTransactions';

export type TokenListMode = 'view' | 'select';

interface FnxFloatingButtonContextValue {
  theme: 'dark' | 'light';
  effectivePosition: FloatingButtonPosition;
  isLeftSide: boolean;
  isTopSide: boolean;
}

const FnxFloatingButtonContext = createContext<FnxFloatingButtonContextValue | null>(null);

interface FnxFloatingButtonProviderProps {
  children?: ReactNode;
}

export const FnxFloatingButtonProvider: React.FC<FnxFloatingButtonProviderProps> = ({ children }) => {
  const { state } = useCofheContext();

  const theme = state.theme;
  const effectivePosition = state.position;
  const isLeftSide = effectivePosition.includes('left');
  const isTopSide = effectivePosition.includes('top');

  useTrackPendingTransactions();

  return (
    <FnxFloatingButtonContext.Provider
      value={{
        theme,
        effectivePosition,
        isLeftSide,
        isTopSide,
      }}
    >
      {children}
    </FnxFloatingButtonContext.Provider>
  );
};

export const useFnxFloatingButtonContext = (): FnxFloatingButtonContextValue => {
  const context = useContext(FnxFloatingButtonContext);
  if (!context) {
    throw new Error('useFnxFloatingButtonContext must be used within FnxFloatingButtonProvider');
  }
  return context;
};
