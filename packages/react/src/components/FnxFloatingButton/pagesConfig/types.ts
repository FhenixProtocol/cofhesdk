import type { GeneratePermitPageProps } from '../pages/permits/GeneratePermitPage/types';
import type { PermitDetailsPageProps } from '../pages/permits/PermitDetailsPage/types';

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
  Debug = 'debug',
}

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
  [FloatingButtonPage.GeneratePermits]: GeneratePermitPageProps;
  [FloatingButtonPage.ReceivePermits]: void;
  [FloatingButtonPage.PermitDetails]: PermitDetailsPageProps;
  [FloatingButtonPage.Debug]: void;
};

export type PageState<K extends FloatingButtonPage = FloatingButtonPage> = {
  page: K;
  props?: FloatingButtonPagePropsMap[K];
};

export type PagesWithProps = {
  [K in FloatingButtonPage]: FloatingButtonPagePropsMap[K] extends void ? never : K;
}[FloatingButtonPage];

export type PagesWithoutProps = {
  [K in FloatingButtonPage]: FloatingButtonPagePropsMap[K] extends void ? K : never;
}[FloatingButtonPage];
