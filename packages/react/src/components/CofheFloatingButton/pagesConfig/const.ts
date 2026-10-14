import type { FC } from 'react';
import {
  ActivityPage,
  GenerateACPPage,
  MainPage,
  ACPsListPage,
  SendPage,
  SettingsPage,
  TokenInfoPage,
  DebugPage,
  ShieldPageV2,
  DelegateACPPage,
  ImportACPPage,
  IncomingSharesPage,
} from '../pages';
import { FloatingButtonPage } from './types';
import { PortfolioPage } from '../pages/PortfolioPage';
import { ClaimableTokens } from '../pages/ClaimableTokens';

export const pages: Record<FloatingButtonPage, FC<any>> = {
  [FloatingButtonPage.Main]: MainPage,
  [FloatingButtonPage.Settings]: SettingsPage,
  [FloatingButtonPage.TokenInfo]: TokenInfoPage,
  [FloatingButtonPage.Send]: SendPage,
  [FloatingButtonPage.Shield]: ShieldPageV2,
  [FloatingButtonPage.Activity]: ActivityPage,
  [FloatingButtonPage.ACPs]: ACPsListPage,
  [FloatingButtonPage.GenerateACPs]: GenerateACPPage,
  [FloatingButtonPage.DelegateACPs]: DelegateACPPage,
  [FloatingButtonPage.ReceiveACPs]: ImportACPPage,
  [FloatingButtonPage.IncomingShares]: IncomingSharesPage,
  [FloatingButtonPage.Debug]: DebugPage,
  [FloatingButtonPage.Portfolio]: PortfolioPage,
  [FloatingButtonPage.ClaimableTokens]: ClaimableTokens,
};
