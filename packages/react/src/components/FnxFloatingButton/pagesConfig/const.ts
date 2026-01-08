import {
  ActivityPage,
  GeneratePermitPage,
  MainPage,
  PermitDetailsPage,
  PermitsListPage,
  ReceivePermitPage,
  SendPage,
  SettingsPage,
  // ShieldPage,
  TokenInfoPage,
  TokenListPage,
  DebugPage,
  ShieldPageV2,
} from '../pages';

import type { FC } from 'react';
import { FloatingButtonPage } from './types';

export const pages: Record<FloatingButtonPage, FC<any>> = {
  [FloatingButtonPage.Main]: MainPage,
  [FloatingButtonPage.Settings]: SettingsPage,
  [FloatingButtonPage.TokenList]: TokenListPage,
  [FloatingButtonPage.TokenInfo]: TokenInfoPage,
  [FloatingButtonPage.Send]: SendPage,
  // [FloatingButtonPage.Shield]: ShieldPage,
  [FloatingButtonPage.Shield]: ShieldPageV2,
  [FloatingButtonPage.Activity]: ActivityPage,
  [FloatingButtonPage.Permits]: PermitsListPage,
  [FloatingButtonPage.GeneratePermits]: GeneratePermitPage,
  [FloatingButtonPage.ReceivePermits]: ReceivePermitPage,
  [FloatingButtonPage.PermitDetails]: PermitDetailsPage,
  [FloatingButtonPage.Debug]: DebugPage,
};

type PropsOf<T> = T extends React.ComponentType<infer P> ? P : never;

// Consumers can augment this map via declaration merging or module-local typing.
// By default, props are typed as unknown per page.
export type FloatingButtonPagePropsMap = {
  [FloatingButtonPage.Main]: void;
  [FloatingButtonPage.Settings]: void;
  [FloatingButtonPage.TokenList]: PropsOf<typeof TokenListPage>;
  [FloatingButtonPage.TokenInfo]: void;
  [FloatingButtonPage.Send]: PropsOf<typeof SendPage>;
  [FloatingButtonPage.Shield]: void;
  [FloatingButtonPage.Activity]: void;
  [FloatingButtonPage.Permits]: void;
  [FloatingButtonPage.GeneratePermits]: PropsOf<typeof GeneratePermitPage>;
  [FloatingButtonPage.ReceivePermits]: void;
  [FloatingButtonPage.PermitDetails]: PropsOf<typeof PermitDetailsPage>;
  [FloatingButtonPage.Debug]: void;
};
