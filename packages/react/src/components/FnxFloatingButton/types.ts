import type { ReactNode } from 'react';
import type { BaseProps } from '../../types/component-types';
import type { PageState } from './pagesConfig/types';
export type FloatingButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type FloatingButtonSize = 'small' | 'medium' | 'large';
export type FloatingButtonPositionType = 'fixed' | 'absolute';

export interface FnxFloatingButtonProps extends BaseProps {
  /** Position of the floating button */
  position?: FloatingButtonPosition;

  /** Allow predefined sizes */
  size?: FloatingButtonSize;

  buttonClassName?: string;
  statusBarClassName?: string;
  contentSectionClassName?: string;
  toastsSectionClassName?: string;

  /** Click handler */
  onClick?: () => void;
  /** Z-index value (default: 9999) */
  zIndex?: number;
  /** Position type: 'fixed' stays on screen, 'absolute' positions within parent (default: 'fixed') */
  positionType?: FloatingButtonPositionType;
  /** Dark mode for the button (independent of page theme) */
  darkMode?: boolean;
  /** Chain switch handler - called when user selects a different chain in the network dropdown */
  onSelectChain?: (chainId: number) => Promise<void> | void;
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

export type FnxFloatingButtonToastByComponentParams = Pick<FnxFloatingButtonToast, 'content'> & {
  duration?: number | 'infinite';
};

export type FnxFloatingButtonToastByFunctionParams = {
  variant: FhxFloatingButtonToastVariant;
  duration?: number | 'infinite';
  title: string;
  // Optional content and actions
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

export type FhxFloatingButtonToastVariant = 'info' | 'success' | 'error' | 'warning';
