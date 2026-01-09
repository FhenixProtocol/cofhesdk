import { type ReactNode, createContext, useContext, useState, useEffect, isValidElement, useRef, useMemo } from 'react';
import type { FloatingButtonPosition, FnxFloatingButtonToast, FnxStatus, FnxToastImperativeParams } from './types';
import { useCofheContext } from '../../providers';
import { checkPendingTransactions, stopPendingTransactionPolling } from '../../stores/transactionStore';
import { useCofhePublicClient } from '@/hooks/useCofheConnection';
import {
  FloatingButtonPage,
  PortalModal,
  type FloatingButtonPagePropsMap,
  type OpenPortalModalFn,
  type PageState,
  type PagesWithoutProps,
  type PagesWithProps,
  type PortalModalPropsMap,
  type PortalModalState,
} from './pagesConfig/types';
import { ToastPrimitive } from './components/ToastPrimitives';
import type { Token } from '@/hooks';
import type { FloatingButtonPagePropsMap } from './pagesConfig/types';
import { FloatingButtonPage } from './pagesConfig/types';

export type TokenListMode = 'view' | 'select';

const ANIM_DURATION = 300;

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
  theme: 'dark' | 'light';
  effectivePosition: FloatingButtonPosition;
  isLeftSide: boolean;
  isTopSide: boolean;

  openPortal: () => void;
  closePortal: () => void;
  togglePortal: (externalOnClick?: () => void) => void;
  portalOpen: boolean;
  statusPanelOpen: boolean; // Status bar is expanded when panel is opened or status is populated with warning/error
  contentPanelOpen: boolean; // Panel is expanded when main content is visible (generating permit etc)

  // Toasts
  toasts: FnxFloatingButtonToast[];
  addToast: (toast: React.ReactNode | FnxToastImperativeParams, duration?: number | 'infinite') => void;
  pauseToast: (id: string, paused: boolean) => void;
  removeToast: (id: string) => void;

  // Status
  statuses: FnxStatus[];
  addStatus: (status: FnxStatus) => void;
  removeStatus: (id: string) => void;

  // Content sizing
  contentHeights: Array<{ id: string; height: number }>;
  maxContentHeight: number;
  setContentHeight: (id: string, height: number) => void;
  removeContentHeight: (id: string) => void;

  // Modal
  modalStack: PortalModalState[];
  openModal: OpenPortalModalFn;
  closeModal: (modal: PortalModal) => void;
}

const FnxFloatingButtonContext = createContext<FnxFloatingButtonContextValue | null>(null);

interface FnxFloatingButtonProviderProps {
  children?: ReactNode;
}

export const FnxFloatingButtonProvider: React.FC<FnxFloatingButtonProviderProps> = ({ children }) => {
  const { state } = useCofheContext();

  const theme = state.theme;
  const effectivePosition = state.position;

  const [pageHistory, setPageHistory] = useState<PageState[]>([{ page: FloatingButtonPage.Main }]);
  const [overridingPage, setOverridingPage] = useState<PageState | null>(null);

  const [portalOpen, setPortalOpen] = useState(false);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [contentPanelOpen, setContentPanelOpen] = useState(false);

  const [tokenListMode, setTokenListMode] = useState<TokenListMode>('view');
  const [selectedToken, setSelectedToken] = useState<Token>();
  const [viewingToken, setViewingToken] = useState<Token>();
  const [toasts, setToasts] = useState<FnxFloatingButtonToast[]>([]);
  const [statuses, setStatuses] = useState<FnxStatus[]>([]);

  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publicClient = useCofhePublicClient();

  // Check pending transactions on mount
  // TODO: should be wrapped into react-query too, because the way it is now is inefficient (i.e no batching etc) and prone to errors
  useEffect(() => {
    checkPendingTransactions(() => publicClient);
    return () => {
      stopPendingTransactionPolling();
    };
  }, [publicClient]);

  const currentPage = overridingPage ?? pageHistory[pageHistory.length - 1];
  const isLeftSide = effectivePosition.includes('left');
  const isTopSide = effectivePosition.includes('top');

  const openPortal = () => {
    setPortalOpen(true);

    // Cancel closing timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    // Open status panel immediately
    setStatusPanelOpen(true);

    if (statusPanelOpen || statuses.length > 0) {
      // Expand content immediately if status panel is visible
      setContentPanelOpen(true);
    } else {
      // Else expand content after a delay
      openTimeoutRef.current = setTimeout(() => {
        setContentPanelOpen(true);
      }, ANIM_DURATION);
    }
  };

  const closePortal = () => {
    setPortalOpen(false);

    // Cancel opening timeout
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }

    // Close content panel immediately
    setContentPanelOpen(false);

    // Close status bar after a delay
    closeTimeoutRef.current = setTimeout(() => {
      setStatusPanelOpen(false);
    }, ANIM_DURATION);
  };

  const togglePortal = () => {
    portalOpen ? closePortal() : openPortal();
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

  const addStatus = (status: FnxStatus) => {
    setStatuses((prev) => [...prev, status]);
  };

  const removeStatus = (id: string) => {
    setStatuses((prev) => prev.filter((status) => status.id !== id));
  };

  // Content sizing
  const [contentHeights, setContentHeights] = useState<Array<{ id: string; height: number }>>([]);
  const maxContentHeight = useMemo(() => {
    return contentHeights.reduce((max, height) => Math.max(max, height.height), 0);
  }, [contentHeights]);

  const setContentHeight = (id: string, height: number) => {
    setContentHeights((prev) => {
      const existing = prev.find((h) => h.id === id);
      if (existing) {
        if (existing.height === height) return prev;
        return prev.map((h) => (h.id === id ? { ...h, height } : h));
      }
      return [...prev, { id, height }];
    });
  };
  const removeContentHeight = (id: string) => {
    setContentHeights((prev) => prev.filter((height) => height.id !== id));
  };

  // Modal
  const [modalStack, setModalStack] = useState<PortalModalState[]>([]);
  const openModal = <M extends PortalModal>(
    ...args: PortalModalPropsMap[M] extends void ? [modal: M] : [modal: M, props: PortalModalPropsMap[M]]
  ) => {
    const [modal, props] = args;
    const onClose = () => closeModal(modal);
    const modalState = { modal, onClose, ...(props ?? {}) } as PortalModalState;
    setModalStack((prev) => [...prev, modalState]);
  };
  const closeModal = (modal: PortalModal) => {
    setModalStack((prev) => prev.filter((m) => m.modal !== modal));
  };

  console.log('modalStack', modalStack);

  return (
    <FnxFloatingButtonContext.Provider
      value={{
        pageHistory,
        currentPage,
        navigateTo,
        navigateBack,
        theme,
        effectivePosition,
        portalOpen,
        statusPanelOpen,
        contentPanelOpen,
        isLeftSide,
        isTopSide,
        openPortal,
        closePortal,
        togglePortal,
        toasts,
        addToast,
        pauseToast,
        removeToast,
        statuses,
        addStatus,
        removeStatus,
        contentHeights,
        maxContentHeight,
        setContentHeight,
        removeContentHeight,
        modalStack,
        openModal,
        closeModal,
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
