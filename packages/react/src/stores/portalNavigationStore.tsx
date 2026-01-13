import {
  FloatingButtonPage,
  type FloatingButtonPagePropsMap,
  type PageState,
  type PagesWithProps,
} from '@/components/FnxFloatingButton/pagesConfig/types';
import { create } from 'zustand';

export type NavigateParams = {
  // When true, do not append to history; override current page instead
  skipPagesHistory?: boolean;
};

export type NavigateArgs<K extends FloatingButtonPage> = {
  pageProps?: FloatingButtonPagePropsMap[K];
  navigateParams?: NavigateParams;
};

type NavigateToFn = <K extends FloatingButtonPage>(
  ...args: K extends PagesWithProps ? [page: K, props: NavigateArgs<K>] : [page: K, props?: NavigateArgs<K>]
) => void;

type PortalNavigationStore = {
  pageHistory: PageState[];
  overridingPage: PageState | null;
};

type PortalNavigationActions = {
  navigateTo: NavigateToFn;
  navigateBack: () => void;
};

export const usePortalNavigation = create<PortalNavigationStore & PortalNavigationActions>()((set, get) => ({
  pageHistory: [{ page: FloatingButtonPage.Main }],
  overridingPage: null,

  navigateTo: <K extends FloatingButtonPage>(
    ...args: K extends PagesWithProps ? [page: K, props: NavigateArgs<K>] : [page: K, props?: NavigateArgs<K>]
  ) => {
    const [page, props] = args;
    const skipPagesHistory = props?.navigateParams?.skipPagesHistory === true;
    if (skipPagesHistory) {
      set({ overridingPage: { page, props } as PageState });
    } else {
      const existing = get().pageHistory;
      const updated = [...existing, { page, props } as PageState];
      set({ pageHistory: updated });
    }
  },
  navigateBack: () => set({ pageHistory: get().pageHistory.slice(0, -1) }),
}));

export const usePortalCurrentPage = () => {
  const { overridingPage, pageHistory } = usePortalNavigation();
  return overridingPage ?? pageHistory[pageHistory.length - 1];
};
