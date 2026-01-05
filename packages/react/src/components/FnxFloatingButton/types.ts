import type { ReactNode } from 'react';
import type { BaseProps } from '../../types/component-types';
import type { PageState } from './pagesConfig/types';
export type FloatingButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type FloatingButtonPositionType = 'fixed' | 'absolute';

export interface FnxFloatingButtonProps extends BaseProps {
  children?: React.ReactNode;
  /** Position of the floating button */
  position?: FloatingButtonPosition;

  buttonClassName?: string;
  statusBarClassName?: string;
  contentSectionClassName?: string;
  toastsSectionClassName?: string;

  /** Z-index value (default: 9999) */
  zIndex?: number;
  /** Position type: 'fixed' stays on screen, 'absolute' positions within parent (default: 'fixed') */
  positionType?: FloatingButtonPositionType;
  /** Dark mode for the button (independent of page theme) */
  darkMode?: boolean;

  // is used for error handling (i.e. override to Permit Creation page on PermitNotFound error)
  overriddingPage?: PageState;
}

export type FnxFloatingButtonToast = {
  id: string;

  duration: number | 'infinite';
  startMs: number;
  remainingMs: number;
  paused: boolean;

  content: ReactNode;
};

export type FnxToastInjectedProps = {
  id?: string;
  duration?: number | 'infinite';
  paused?: boolean;
  startMs?: number;
  remainingMs?: number;
  onPause?: (paused: boolean) => void;
  onDismiss?: () => void;
};

export type FnxToastImperativeParams = {
  variant?: FnxToastVariant;
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

export type FnxToastVariant = 'info' | 'success' | 'error' | 'warning';
