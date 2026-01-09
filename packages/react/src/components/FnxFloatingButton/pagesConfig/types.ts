import { FloatingButtonPage } from './simpleTypes';

// Registry interface to be augmented by each page's types nearby the page.
// This lets page prop types live next to their components without creating cycles.
export interface FloatingButtonPagePropsRegistry {}

// Consumers can augment this map via declaration merging or module-local typing.
// By default, props are typed as unknown per page.
// TODO: Dry Up with the help of the struct above
export type FloatingButtonPagePropsMap = {
  [FloatingButtonPage.Main]: void;
  [FloatingButtonPage.Settings]: void;
  // [FloatingButtonPage.TokenList]: void;
  [FloatingButtonPage.TokenInfo]: void;
  // [FloatingButtonPage.Send]: void;
  [FloatingButtonPage.Shield]: void;
  [FloatingButtonPage.Activity]: void;
  [FloatingButtonPage.Permits]: void;
  // [FloatingButtonPage.GeneratePermits]: void;
  [FloatingButtonPage.ReceivePermits]: void;
  // [FloatingButtonPage.PermitDetails]: void;
  [FloatingButtonPage.Debug]: void;
} & FloatingButtonPagePropsRegistry;

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
