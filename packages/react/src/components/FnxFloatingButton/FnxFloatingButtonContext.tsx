import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useCofheContext } from '../../providers';
import { type PermitDetailsPageProps } from './pages/permits/PermitDetailsPage/index.js';
import { checkPendingTransactions, stopPendingTransactionPolling } from '../../stores/transactionStore.js';
import { useCofhePublicClient } from '@/hooks/useCofheConnection.js';

export type FloatingButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type FloatingButtonSize = 'small' | 'medium' | 'large';
export type FloatingButtonPositionType = 'fixed' | 'absolute';

export enum FloatingButtonPage {
  Main = 'main',
  Settings = 'settings',
  TokenList = 'tokenlist',
  TokenInfo = 'tokeninfo',
  Send = 'send',
  Shield = 'shield',
  Activity = 'activity',
  Permits = 'permits',
  GeneratePermits = 'generatePermit',
  ReceivePermits = 'receivePermit',
  PermitDetails = 'permitDetails',
}

export type TokenListMode = 'view' | 'select';

export type NativeToken = {
  address: 'native';
  name: 'Ether';
  symbol: 'ETH';
  decimals: 18;
  logoURI?: string;
  isNative: true;
};

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

// Consumers can augment this map via declaration merging or module-local typing.
// By default, props are typed as unknown per page.
export type FloatingButtonPagePropsMap = {
  [FloatingButtonPage.Main]: void;
  [FloatingButtonPage.Settings]: void;
  [FloatingButtonPage.TokenList]: void;
  [FloatingButtonPage.TokenInfo]: void;
  [FloatingButtonPage.Send]: void;
  [FloatingButtonPage.Shield]: void;
  [FloatingButtonPage.Activity]: void;
  [FloatingButtonPage.Permits]: void;
  [FloatingButtonPage.GeneratePermits]: void;
  [FloatingButtonPage.ReceivePermits]: void;
  [FloatingButtonPage.PermitDetails]: PermitDetailsPageProps;
};

type PageState<K extends FloatingButtonPage = FloatingButtonPage> = {
  page: K;
  props?: FloatingButtonPagePropsMap[K];
};

export type PagesWithProps = {
  [K in FloatingButtonPage]: FloatingButtonPagePropsMap[K] extends void ? never : K;
}[FloatingButtonPage];

export type PagesWithoutProps = {
  [K in FloatingButtonPage]: FloatingButtonPagePropsMap[K] extends void ? K : never;
}[FloatingButtonPage];

type NavigateToFn = {
  // Pages that don't require props: call with just the page
  <K extends PagesWithoutProps>(page: K): void;
  // Pages that require props: enforce passing props
  <K extends PagesWithProps>(page: K, props: FloatingButtonPagePropsMap[K]): void;
};

interface FnxFloatingButtonContextValue {
  pageHistory: PageState[];
  currentPage: PageState;
  navigateTo: NavigateToFn;
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
  onSelectChain?: (chainId: number) => Promise<void> | void;
  // Token selection
  tokenListMode: TokenListMode;
  selectedToken: SelectedToken;
  navigateToTokenListForSelection: () => void;
  selectToken: (token: SelectedToken) => void;
  // Token viewing
  viewingToken: SelectedToken;
  navigateToTokenInfo: (token: SelectedToken) => void;
  // Config
  showNativeTokenInList: boolean;
}

const FnxFloatingButtonContext = createContext<FnxFloatingButtonContextValue | null>(null);

interface FnxFloatingButtonProviderProps {
  children: ReactNode;
  darkMode: boolean;
  position?: FloatingButtonPosition;
  onSelectChain?: (chainId: number) => Promise<void> | void;
}

export const FnxFloatingButtonProvider: React.FC<FnxFloatingButtonProviderProps> = ({
  children,
  darkMode,
  position,
  onSelectChain,
}) => {
  const { client: cofhesdkClient, config } = useCofheContext();
  const widgetConfig = config.react;
  const effectivePosition = position || widgetConfig.position;
  const showNativeTokenInList = widgetConfig.showNativeTokenInList;

  const [pageHistory, setPageHistory] = useState<PageState[]>([{ page: FloatingButtonPage.Main }]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPopupPanel, setShowPopupPanel] = useState(false);
  const [tokenListMode, setTokenListMode] = useState<TokenListMode>('view');
  const [selectedToken, setSelectedToken] = useState<SelectedToken>(null);
  const [viewingToken, setViewingToken] = useState<SelectedToken>(null);
  const publicClient = useCofhePublicClient();

  // Check pending transactions on mount
  useEffect(() => {
    checkPendingTransactions(() => publicClient);
    return () => {
      stopPendingTransactionPolling();
    };
  }, [cofhesdkClient]);

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

  function navigateTo<K extends PagesWithoutProps>(page: K): void;
  // eslint-disable-next-line no-redeclare
  function navigateTo<K extends PagesWithProps>(page: K, props: FloatingButtonPagePropsMap[K]): void;
  // eslint-disable-next-line no-redeclare
  function navigateTo(page: FloatingButtonPage, props?: FloatingButtonPagePropsMap[FloatingButtonPage]): void {
    setPageHistory((prev) => [...prev, { page, props }]);
  }

  const navigateBack = () => {
    setPageHistory((prev) => {
      if (prev.length > 1) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  const navigateToTokenListForSelection = () => {
    setTokenListMode('select');
    navigateTo(FloatingButtonPage.TokenList);
  };

  const selectToken = (token: SelectedToken) => {
    setSelectedToken(token);
    navigateBack(); // Return to previous page after selection
  };

  const navigateToTokenInfo = (token: SelectedToken) => {
    setViewingToken(token);
    navigateTo(FloatingButtonPage.TokenInfo);
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
        onSelectChain,
        tokenListMode,
        selectedToken,
        navigateToTokenListForSelection,
        selectToken,
        viewingToken,
        navigateToTokenInfo,
        showNativeTokenInList,
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
