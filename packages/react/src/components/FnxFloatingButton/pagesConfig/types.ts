import type { FloatingButtonPagePropsMap } from './const';

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
