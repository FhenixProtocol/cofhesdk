import { FloatingButtonPage } from './FnxFloatingButtonContext';
import {
  ActivityPage,
  GeneratePermitPage,
  MainPage,
  PermitDetailsPage,
  PermitsListPage,
  ReceivePermitPage,
  SendPage,
  SettingsPage,
  ShieldPage,
  TokenInfoPage,
  TokenListPage,
} from './pages';

import type { FC } from 'react';

export const pages: Record<FloatingButtonPage, FC<any>> = {
  [FloatingButtonPage.Main]: MainPage,
  [FloatingButtonPage.Settings]: SettingsPage,
  [FloatingButtonPage.TokenList]: TokenListPage,
  [FloatingButtonPage.TokenInfo]: TokenInfoPage,
  [FloatingButtonPage.Send]: SendPage,
  [FloatingButtonPage.Shield]: ShieldPage,
  [FloatingButtonPage.Activity]: ActivityPage,
  [FloatingButtonPage.Permits]: PermitsListPage,
  [FloatingButtonPage.GeneratePermits]: GeneratePermitPage,
  [FloatingButtonPage.ReceivePermits]: ReceivePermitPage,
  [FloatingButtonPage.PermitDetails]: PermitDetailsPage,
};
