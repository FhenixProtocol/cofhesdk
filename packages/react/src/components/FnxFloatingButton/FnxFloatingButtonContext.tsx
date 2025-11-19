import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type FloatingButtonPage = 'main' | 'settings' | 'tokenlist';

interface FnxFloatingButtonContextValue {
  pageHistory: FloatingButtonPage[];
  currentPage: FloatingButtonPage;
  navigateToSettings: () => void;
  navigateToTokenList: () => void;
  navigateBack: () => void;
  darkMode: boolean;
}

const FnxFloatingButtonContext = createContext<FnxFloatingButtonContextValue | null>(null);

interface FnxFloatingButtonProviderProps {
  children: ReactNode;
  darkMode: boolean;
}

export const FnxFloatingButtonProvider: React.FC<FnxFloatingButtonProviderProps> = ({
  children,
  darkMode,
}) => {
  const [pageHistory, setPageHistory] = useState<FloatingButtonPage[]>(['main']);

  const currentPage = pageHistory[pageHistory.length - 1];

  const navigateToSettings = () => {
    setPageHistory((prev) => [...prev, 'settings']);
  };

  const navigateToTokenList = () => {
    setPageHistory((prev) => [...prev, 'tokenlist']);
  };

  const navigateBack = () => {
    setPageHistory((prev) => {
      if (prev.length > 1) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  return (
    <FnxFloatingButtonContext.Provider
      value={{
        pageHistory,
        currentPage,
        navigateToSettings,
        navigateToTokenList,
        navigateBack,
        darkMode,
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

