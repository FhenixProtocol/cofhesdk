/* eslint-disable no-redeclare */
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
  replace: NavigateToFn;
  clearNavigationHistory: () => void;
};

export const usePortalNavigation = create<PortalNavigationStore & PortalNavigationActions>()((set, get) => {
  function clearNavigationHistory(): void {
    set({ pageHistory: [{ page: FloatingButtonPage.Main }], overridingPage: null });
  }

  function warnIfAlreadyOnPage<K extends FloatingButtonPage>(page: K): boolean {
    const currentPage = get().overridingPage ?? get().pageHistory[get().pageHistory.length - 1];
    const onPage = currentPage?.page === page;
    if (onPage) {
      console.warn(`Attempted to navigate to page ${page} but already on that page`);
    }
    return onPage;
  }

  function navigateTo<K extends PagesWithoutProps>(page: K, args?: NavigateArgs<K>): void;
  function navigateTo<K extends PagesWithProps>(page: K, args: NavigateArgs<K>): void;
  function navigateTo<K extends FloatingButtonPage>(page: K, args?: NavigateArgs<K>): void {
    if (warnIfAlreadyOnPage(page)) return;

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

  function replace<K extends PagesWithoutProps>(page: K, args?: NavigateArgs<K>): void;
  function replace<K extends PagesWithProps>(page: K, args: NavigateArgs<K>): void;
  function replace<K extends FloatingButtonPage>(page: K, args?: NavigateArgs<K>): void {
    if (warnIfAlreadyOnPage(page)) return;

    clearNavigationHistory();
    navigateTo(page as any, args);
  }

  return {
    pageHistory: [{ page: FloatingButtonPage.Main }],
    overridingPage: null,

    clearNavigationHistory,
    navigateTo,
    navigateBack: () => {
      if (get().overridingPage !== null) {
        // if currently there is an overriding page, just remove it
        set({ overridingPage: null });
      } else {
        // otherwise pop last page from history
        set({ pageHistory: get().pageHistory.slice(0, -1) });
      }
    },
    replace,
  };
});

export const usePortalCurrentPage = () => {
  const { overridingPage, pageHistory } = usePortalNavigation();
  return overridingPage ?? pageHistory[pageHistory.length - 1];
};
