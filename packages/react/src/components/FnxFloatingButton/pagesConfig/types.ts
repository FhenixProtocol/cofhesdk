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
  DelegatePermits = 'delegatePermit',
  ReceivePermits = 'receivePermit',
  PermitDetails = 'permitDetails',
  Debug = 'debug',
}

// Registry interface to be augmented by each page's types nearby the page.
// This lets page prop types live next to their components without creating cycles.
export interface FloatingButtonPagePropsRegistry {}

// Consumers can augment this map via declaration merging or module-local typing.
// By default, every page has `void` props unless explicitly provided
// via `FloatingButtonPagePropsRegistry` through declaration merging.
export type FloatingButtonPagePropsMap = {
  [K in FloatingButtonPage]: K extends keyof FloatingButtonPagePropsRegistry
    ? FloatingButtonPagePropsRegistry[K]
    : void;
};

export type PageState<K extends keyof FloatingButtonPagePropsMap = FloatingButtonPage> = {
  page: K;
  props?: FloatingButtonPagePropsMap[K];
};

export type PagesWithProps = {
  [K in keyof FloatingButtonPagePropsMap]: FloatingButtonPagePropsMap[K] extends void ? never : K;
}[FloatingButtonPage];

export type PagesWithoutProps = {
  [K in keyof FloatingButtonPagePropsMap]: FloatingButtonPagePropsMap[K] extends void ? K : never;
}[FloatingButtonPage];

export function isPageWithProps<K extends FloatingButtonPage>(page: K): page is K & PagesWithProps {
  return !(page in ({} as Record<PagesWithoutProps, true>));
}

export function isPageWithoutProps<K extends FloatingButtonPage>(page: K): page is K & PagesWithoutProps {
  return page in ({} as Record<PagesWithoutProps, true>);
}
