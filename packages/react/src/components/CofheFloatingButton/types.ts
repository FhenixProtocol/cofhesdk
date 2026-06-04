import type { ReactNode } from 'react';
import type { BaseProps } from '../../types/component-types';
import type { PageState } from './pagesConfig/types';
export type FloatingButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type FloatingButtonPositionType = 'fixed' | 'absolute';

export interface CofheFloatingButtonProps extends BaseProps {
  children?: React.ReactNode;
  /** Position of the floating button */
  position?: FloatingButtonPosition;

  /** Z-index value (default: 9999) */
  zIndex?: number;
  /** Position type: 'fixed' stays on screen, 'absolute' positions within parent (default: 'fixed') */
  positionType?: FloatingButtonPositionType;
  /** Dark mode for the button (independent of page theme) */
  darkMode?: boolean;

  // is used for error handling (i.e. override to Permit Creation page on PermitNotFound error)
  overriddingPage?: PageState;
}

export type CofheFloatingButtonToast = {
  id: string;

  duration: number | 'infinite';
  startMs: number;
  remainingMs: number;
  paused: boolean;

  content: ReactNode;
};

export type CofheToastInjectedProps = {
  id?: string;
  duration?: number | 'infinite';
  paused?: boolean;
  startMs?: number;
  remainingMs?: number;
  onPause?: (paused: boolean) => void;
  onDismiss?: () => void;
};

export type CofheToastImperativeParams = {
  variant?: CofheToastVariant;
  title: string;
  description?: string;
  transaction?: {
    hash: string;
    chainId: number;
  };
  action?: {
    label: string;
    onClick: () => void;
  };
};

export type CofheToastVariant = 'info' | 'success' | 'error' | 'warning';

export const CofheStatusActionIntents = {
  openPermits: 'open-permits',
  openClaimableTokens: 'open-claimable-tokens',
} as const;

export type CofheStatusActionIntent = (typeof CofheStatusActionIntents)[keyof typeof CofheStatusActionIntents];

/**
 * Status ids emitted by the SDK's built-in status watchers.
 *
 * `useCofheStatuses()` may still include additional custom statuses added by
 * internal or app-specific flows, so treat this as the known built-in subset.
 */
export const COFHE_STATUS_IDS = {
  claimsAvailable: 'claims-available',
  missingPermit: 'missing-permit',
  permitExpired: 'permit-expired',
  permitExpiringSoon: 'permit-expiring-soon',
  permitShared: 'permit-shared',
} as const;

export type CofheStatusId = (typeof COFHE_STATUS_IDS)[keyof typeof COFHE_STATUS_IDS];

export type CofheStatusAction = {
  label: string;
  intent: CofheStatusActionIntent;
};

/**
 * Public status shape exposed to consumers.
 *
 * Consumer-facing status actions must declare an intent so the widget can map
 * them to the correct internal handler.
 */
export type CofheStatus = {
  id: string;
  variant: CofheStatusVariant;
  title: string;
  description?: string;
  action?: CofheStatusAction;
};

export type CofheStatusVariant = 'error' | 'warning' | 'info';
