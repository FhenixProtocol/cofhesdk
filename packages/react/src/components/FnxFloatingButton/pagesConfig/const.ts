import type { FC } from 'react';
import {
  ActivityPage,
  GeneratePermitPage,
  MainPage,
  PermitDetailsPage,
  PermitsListPage,
  SendPage,
  SettingsPage,
  TokenInfoPage,
  TokenListPage,
  DebugPage,
  ShieldPageV2,
  DelegatePermitPage,
  ImportPermitPage,
} from '../pages';
import { FloatingButtonPage } from './types';

export const pages: Record<FloatingButtonPage, FC<any>> = {
  [FloatingButtonPage.Main]: MainPage,
  [FloatingButtonPage.Settings]: SettingsPage,
  [FloatingButtonPage.TokenList]: TokenListPage,
  [FloatingButtonPage.TokenInfo]: TokenInfoPage,
  [FloatingButtonPage.Send]: SendPage,
  [FloatingButtonPage.Shield]: ShieldPageV2,
  [FloatingButtonPage.Activity]: ActivityPage,
  [FloatingButtonPage.Permits]: PermitsListPage,
  [FloatingButtonPage.GeneratePermits]: GeneratePermitPage,
  [FloatingButtonPage.DelegatePermits]: DelegatePermitPage,
  [FloatingButtonPage.ReceivePermits]: ImportPermitPage,
  [FloatingButtonPage.PermitDetails]: PermitDetailsPage,
  [FloatingButtonPage.Debug]: DebugPage,
};
