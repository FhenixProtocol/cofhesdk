import { type ReactNode, createContext, useContext, useState, useEffect, isValidElement } from 'react';
import type { FloatingButtonPosition, FnxFloatingButtonToast, FnxToastImperativeParams } from './types';
import { useCofheContext } from '../../providers';
import { checkPendingTransactions, stopPendingTransactionPolling } from '../../stores/transactionStore';
import { useCofhePublicClient } from '@/hooks/useCofheConnection';
import {
  FloatingButtonPage,
  type FloatingButtonPagePropsMap,
  type PageState,
  type PagesWithoutProps,
  type PagesWithProps,
} from './pagesConfig/types';
import { useCofheActivePermit } from '@/hooks/index';
import { ToastPrimitive } from './components/ToastPrimitives';

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

export const FNX_DEFAULT_TOAST_DURATION = 5000;

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

  // enable background decryption. For example - within useConfidentialBalance hook
  enableBackgroundDecryption: boolean;
  setEnableBackgroundDecryption: (enabled: boolean) => void;

  // Toasts
  toasts: FnxFloatingButtonToast[];
  addToast: (toast: React.ReactNode | FnxToastImperativeParams, duration?: number | 'infinite') => void;
  pauseToast: (id: string, paused: boolean) => void;
  removeToast: (id: string) => void;
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
  const [enableBackgroundDecryption, setEnableBackgroundDecryption] = useState<boolean>(false);
  const [toasts, setToasts] = useState<FnxFloatingButtonToast[]>([]);

  const activePermit = useCofheActivePermit();
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

  const addToast = (
    toast: ReactNode | FnxToastImperativeParams,
    duration: number | 'infinite' = FNX_DEFAULT_TOAST_DURATION
  ) => {
    const content = isValidElement(toast) ? toast : <ToastPrimitive {...(toast as FnxToastImperativeParams)} />;
    setToasts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        duration,
        startMs: Date.now(),
        remainingMs: duration === 'infinite' ? Infinity : duration,
        paused: false,
        content,
      },
    ]);
  };

  const pauseToast = (id: string, paused: boolean) => {
    setToasts((prev) =>
      prev.map((toast) => {
        if (toast.id !== id) return toast;
        if (toast.paused === paused) return toast;

        let remainingMs = toast.remainingMs;
        let startMs = Date.now();
        if (paused) {
          const elapsedMs = Date.now() - toast.startMs;
          remainingMs = Math.max(0, toast.remainingMs - elapsedMs);
        }

        return { ...toast, paused, startMs, remainingMs };
      })
    );
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
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
        enableBackgroundDecryption: !!activePermit || enableBackgroundDecryption,
        setEnableBackgroundDecryption,
        toasts,
        addToast,
        pauseToast,
        removeToast,
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
