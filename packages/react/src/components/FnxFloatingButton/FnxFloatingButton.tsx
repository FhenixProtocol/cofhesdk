import { useState } from 'react';
import type { BaseProps } from '../../types/component-types.js';
import { cn } from '../../utils/cn.js';
import { useCofheContext } from '../../providers';
import { FloatingIcon } from './FloatingIcon.js';
import { StatusBarSection } from './StatusBarSection.js';
import { ContentSection } from './ContentSection.js';
import { FnxFloatingButtonProvider } from './FnxFloatingButtonContext.js';

export type FloatingButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type FloatingButtonSize = 'small' | 'medium' | 'large';
export type FloatingButtonPositionType = 'fixed' | 'absolute';

// TODOS:
// - Get svgs instead of pngs
// - Define configuration that needs to move to global react config
// - Improve expand animation so it will roll out from the floating button

const OPEN_DELAY = 500; // Delay before showing popup in ms
const CLOSE_DELAY = 300; // Delay before closing bar after popup closes

export interface FnxFloatingButtonProps extends BaseProps {
  /** Position of the floating button */
  position?: FloatingButtonPosition;
  
  /** Allow predefined sizes */
  size?: FloatingButtonSize;

  buttonClassName?: string;
  statusBarClassName?: string;
  contentSectionClassName?: string;

  /** Click handler */
  onClick?: () => void;
  /** Z-index value (default: 9999) */
  zIndex?: number;
  /** Position type: 'fixed' stays on screen, 'absolute' positions within parent (default: 'fixed') */
  positionType?: FloatingButtonPositionType;
  /** Dark mode for the button (independent of page theme) */
  darkMode?: boolean;
}

const positionStyles: Record<FloatingButtonPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

const FnxFloatingButtonInner: React.FC<FnxFloatingButtonProps> = ({
  className,
  testId,
  position,
  size = 'large',
  onClick,
  zIndex = 9999,
  positionType = 'fixed',
  darkMode = false,
  buttonClassName,
  statusBarClassName,
  contentSectionClassName,
}) => {
  const widgetConfig = useCofheContext().widgetConfig;

  // Use prop position if provided, otherwise use widgetConfig position
  const effectivePosition = position || widgetConfig?.position || 'bottom-right';

  const [isExpanded, setIsExpanded] = useState(false);
  const [showPopupPanel, setShowPopupPanel] = useState(false);

  const isLeftSide = effectivePosition.includes('left');
  const isTopSide = effectivePosition.includes('top');

  const expandPanel = () => {
    setIsExpanded(true);
    setTimeout(() => {
      setShowPopupPanel(true);
    }, OPEN_DELAY);
  };

  const collapsePanel = () => {
    setShowPopupPanel(false);
    setTimeout(() => {
      setIsExpanded(false);
    }, CLOSE_DELAY);
  };

  const handleClick = () => {
    if (isExpanded) {
      collapsePanel();
    } else {
      expandPanel();
    }
    onClick?.();
  };


  return (
    <div
      data-testid={testId}
      className={cn(
        'fnx-floating-button',
        darkMode && 'dark',
        size,
        positionType,
        'flex',
        positionStyles[effectivePosition],
        // bottom-* opens UP (popup above), top-* opens DOWN (popup below)
        isTopSide ? 'flex-col-reverse items-start' : 'flex-col items-start',
        `z-[${zIndex}]`,
        className
      )}
    >
      <ContentSection
        className={contentSectionClassName}
        showPopupPanel={showPopupPanel}
        isTopSide={isTopSide}
        isLeftSide={isLeftSide}
      />

      {/* Button and Bar Row */}
      <div className={cn('flex items-center', isLeftSide ? 'flex-row' : 'flex-row-reverse')}>
        <FloatingIcon
          onClick={handleClick}
          className={buttonClassName}
          isExpanded={isExpanded}
          darkMode={darkMode}
        />

        <StatusBarSection
          className={statusBarClassName}
          isExpanded={isExpanded}
          isLeftSide={isLeftSide}
        />
      </div>
    </div>
  );
};

export const FnxFloatingButton: React.FC<FnxFloatingButtonProps> = (props) => {
  return (
    <FnxFloatingButtonProvider darkMode={props.darkMode ?? false}>
      <FnxFloatingButtonInner {...props} />
    </FnxFloatingButtonProvider>
  );
};
