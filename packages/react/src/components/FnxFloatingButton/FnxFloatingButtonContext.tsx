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

type NavigateParams = {
  // When true, do not append to history; override current page instead
  skipPagesHistory?: boolean;
};

type NavigateArgs<K extends FloatingButtonPage> = {
  pageProps?: FloatingButtonPagePropsMap[K];
  navigateParams?: NavigateParams;
};
export const FNX_DEFAULT_TOAST_DURATION = 5000;

type NavigateToFn = {
  // For pages without props, second arg is optional and may include navigateParams only
  <K extends PagesWithoutProps>(page: K, args?: NavigateArgs<K>): void;
  // For pages with props, require pageProps inside second arg
  <K extends PagesWithProps>(page: K, args: NavigateArgs<K>): void;
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
  // TODO: I believe we should disable chain switching from within the floating button. We better deal with whatever is provided in Singer
  // onSelectChain?: (chainId: number) => Promise<void> | void;
  // Token selection
  tokenListMode: TokenListMode;
  selectedToken: SelectedToken;
  navigateToTokenListForSelection: (title?: string) => void;
  navigateToTokenListForView: () => void;
  selectToken: (token: SelectedToken) => void;
  // Token viewing
  viewingToken: SelectedToken;
  navigateToTokenInfo: (token: SelectedToken) => void;
  // Config
  showNativeTokenInList: boolean;

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
  const [overridingPage, setOverridingPage] = useState<PageState | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPopupPanel, setShowPopupPanel] = useState(false);
  const [tokenListMode, setTokenListMode] = useState<TokenListMode>('view');
  const [selectedToken, setSelectedToken] = useState<SelectedToken>(null);
  const [viewingToken, setViewingToken] = useState<SelectedToken>(null);
  const [toasts, setToasts] = useState<FnxFloatingButtonToast[]>([]);

  const publicClient = useCofhePublicClient();

  // Check pending transactions on mount

  // TODO: shoul be wrapped into react-query too, because the way it is now is inefficient (i.e no batching etc) and prone to errors
  useEffect(() => {
    checkPendingTransactions(() => publicClient);
    return () => {
      stopPendingTransactionPolling();
    };
  }, [publicClient]);

  const currentPage = overridingPage ?? pageHistory[pageHistory.length - 1];
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

  function navigateTo<K extends PagesWithoutProps>(page: K, args?: NavigateArgs<K>): void;
  // eslint-disable-next-line no-redeclare
  function navigateTo<K extends PagesWithProps>(page: K, args: NavigateArgs<K>): void;
  // eslint-disable-next-line no-redeclare
  function navigateTo<K extends FloatingButtonPage>(page: K, args?: NavigateArgs<K>): void {
    const props = args?.pageProps;
    const skipPagesHistory = args?.navigateParams?.skipPagesHistory === true;
    if (skipPagesHistory) {
      setOverridingPage({ page, props });
    } else {
      setOverridingPage(null);
      setPageHistory((prev) => [...prev, { page, props }]);
    }
  }

  const navigateBack = () => {
    // If there's an overriding page, clear it first to reveal history
    setOverridingPage(null);
    setPageHistory((prev) => {
      if (!overridingPage && prev.length > 1) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  const navigateToTokenListForSelection = (title?: string) => {
    setTokenListMode('select');
    navigateTo(FloatingButtonPage.TokenList, { title });
  };

  const navigateToTokenListForView = () => {
    setTokenListMode('view');
    navigateTo(FloatingButtonPage.TokenList, {});
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
        tokenListMode,
        selectedToken,
        navigateToTokenListForSelection,
        navigateToTokenListForView,
        selectToken,
        viewingToken,
        navigateToTokenInfo,
        showNativeTokenInList,
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
