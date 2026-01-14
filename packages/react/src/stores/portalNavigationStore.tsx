import {
  FloatingButtonPage,
  type FloatingButtonPagePropsMap,
  type PageState,
  type PagesWithoutProps,
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

type NavigateToFn = {
  // For pages without props, second arg is optional and may include navigateParams only
  <K extends PagesWithoutProps>(page: K, args?: NavigateArgs<K>): void;
  // For pages with props, require pageProps inside second arg
  <K extends PagesWithProps>(page: K, args: NavigateArgs<K>): void;
};

type PortalNavigationStore = {
  pageHistory: PageState[];
  overridingPage: PageState | null;
};

type PortalNavigationActions = {
  navigateTo: NavigateToFn;
  navigateBack: () => void;
};

export const usePortalNavigation = create<PortalNavigationStore & PortalNavigationActions>()((set, get) => {
  function navigateTo<K extends PagesWithoutProps>(page: K, args?: NavigateArgs<K>): void;
  // eslint-disable-next-line no-redeclare
  function navigateTo<K extends PagesWithProps>(page: K, args: NavigateArgs<K>): void;
  // eslint-disable-next-line no-redeclare
  function navigateTo<K extends FloatingButtonPage>(page: K, args?: NavigateArgs<K>): void {
    const props = args?.pageProps;
    const skipPagesHistory = args?.navigateParams?.skipPagesHistory === true;
    if (skipPagesHistory) {
      set({ overridingPage: { page, props } });
    } else {
      const existing = get().pageHistory;
      const updated = [...existing, { page, props }];
      set({ pageHistory: updated });
    }
  }

  return {
    pageHistory: [{ page: FloatingButtonPage.Main }],
    overridingPage: null,

    navigateTo,
    navigateBack: () => set({ pageHistory: get().pageHistory.slice(0, -1) }),
  };
});

export const usePortalCurrentPage = () => {
  const { overridingPage, pageHistory } = usePortalNavigation();
  return overridingPage ?? pageHistory[pageHistory.length - 1];
};
