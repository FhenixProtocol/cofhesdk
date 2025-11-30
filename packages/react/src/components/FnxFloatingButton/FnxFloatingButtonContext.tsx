import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { FloatingButtonPosition } from './FnxFloatingButton.js';
import { useCofheContext } from '../../providers';

export enum FloatingButtonPage {
  Main = 'main',
  Settings = 'settings',
  TokenList = 'tokenlist',
  Send = 'send',
  Shield = 'shield',
  Activity = 'activity',
}

export type TokenListMode = 'view' | 'select';

export type SelectedToken = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  isNative: boolean;
} | null;

const OPEN_DELAY = 500; // Delay before showing popup in ms
const CLOSE_DELAY = 300; // Delay before closing bar after popup closes

interface FnxFloatingButtonContextValue {
  pageHistory: FloatingButtonPage[];
  currentPage: FloatingButtonPage;
  navigateTo: (page: FloatingButtonPage) => void;
  navigateBack: () => void;
  darkMode: boolean;
  effectivePosition: FloatingButtonPosition;
  isExpanded: boolean;
  showPopupPanel: boolean;
  isLeftSide: boolean;
  isTopSide: boolean;
  expandPanel: () => void;
  collapsePanel: () => void;
  handleClick: (externalOnClick?: () => void) => void;
  onChainSwitch?: (chainId: number) => Promise<void>;
  // Token selection
  tokenListMode: TokenListMode;
  selectedToken: SelectedToken;
  navigateToTokenListForSelection: () => void;
  selectToken: (token: SelectedToken) => void;
}

const FnxFloatingButtonContext = createContext<FnxFloatingButtonContextValue | null>(null);

interface FnxFloatingButtonProviderProps {
  children: ReactNode;
  darkMode: boolean;
  position?: FloatingButtonPosition;
  onChainSwitch?: (chainId: number) => Promise<void>;
}

export const FnxFloatingButtonProvider: React.FC<FnxFloatingButtonProviderProps> = ({
  children,
  darkMode,
  position,
  onChainSwitch,
}) => {
  const widgetConfig = useCofheContext().config.react;
  const effectivePosition = position || widgetConfig.position;

  const [pageHistory, setPageHistory] = useState<FloatingButtonPage[]>([FloatingButtonPage.Main]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPopupPanel, setShowPopupPanel] = useState(false);
  const [tokenListMode, setTokenListMode] = useState<TokenListMode>('view');
  const [selectedToken, setSelectedToken] = useState<SelectedToken>(null);

  const currentPage = pageHistory[pageHistory.length - 1];
  const isLeftSide = effectivePosition.includes('left');
  const isTopSide = effectivePosition.includes('top');

  const expandPanel = () => {
    setIsExpanded(true);
    setTimeout(() => {
      setShowPopupPanel(true);
    }, OPEN_DELAY);
  };

  const collapsePanel = () => {
    setShowPopupPanel(false);
    setTimeout(() => {
      setIsExpanded(false);
    }, CLOSE_DELAY);
  };

  const handleClick = (externalOnClick?: () => void) => {
    if (isExpanded) {
      collapsePanel();
    } else {
      expandPanel();
    }
    externalOnClick?.();
  };

  const navigateBack = () => {
    setPageHistory((prev) => {
      if (prev.length > 1) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  const navigateTo = (page: FloatingButtonPage) => {
    setPageHistory((prev) => [...prev, page]);
  };

  const navigateToTokenListForSelection = () => {
    setTokenListMode('select');
    setPageHistory((prev) => [...prev, FloatingButtonPage.TokenList]);
  };

  const selectToken = (token: SelectedToken) => {
    setSelectedToken(token);
    navigateBack(); // Return to previous page after selection
  };

  return (
    <FnxFloatingButtonContext.Provider
      value={{
        pageHistory,
        currentPage,
        navigateTo,
        navigateBack,
        darkMode,
        effectivePosition,
        isExpanded,
        showPopupPanel,
        isLeftSide,
        isTopSide,
        expandPanel,
        collapsePanel,
        handleClick,
        onChainSwitch,
        tokenListMode,
        selectedToken,
        navigateToTokenListForSelection,
        selectToken,
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
