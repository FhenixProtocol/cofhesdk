import { useState } from 'react';
import type { BaseProps } from '../../types/component-types.js';
import { cn } from '../../utils/cn.js';
import { useCofheContext } from '../../providers';
import { FloatingIcon } from './FloatingIcon.js';
import { StatusBarSection } from './StatusBarSection.js';
import { ContentSection } from './ContentSection.js';
import { MainPage, SettingsPage, TokenListPage } from './pages/index.js';

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

export const FnxFloatingButton: React.FC<FnxFloatingButtonProps> = ({
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
  const [pageHistory, setPageHistory] = useState<Array<'main' | 'settings' | 'tokenlist'>>(['main']);

  // These are always enabled for this component
  const currentPage = pageHistory[pageHistory.length - 1];

  const isLeftSide = effectivePosition.includes('left');
  const isTopSide = effectivePosition.includes('top');

  // Page navigation handlers
  const navigateToSettings = () => setPageHistory((prev) => [...prev, 'settings']);
  const navigateToTokenList = () => setPageHistory((prev) => [...prev, 'tokenlist']);
  const navigateBack = () => {
    setPageHistory((prev) => {
      if (prev.length > 1) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  // Page configuration
  const pages = {
    main: <MainPage onNavigateToTokenList={navigateToTokenList} darkMode={darkMode} />,
    settings: <SettingsPage onBack={navigateBack} darkMode={darkMode} />,
    tokenlist: <TokenListPage onBack={navigateBack} darkMode={darkMode} />,
  };

  const currentPopupContent = pages[currentPage];

  const handleClick = () => {
    const newExpandedState = !isExpanded;

    // Handle popup delay
    if (newExpandedState) {
      // Opening: bar first, then popup after delay
      setIsExpanded(true);
      setTimeout(() => {
        setShowPopupPanel(true);
      }, OPEN_DELAY);
    } else {
      // Closing: popup first, then bar after popup animation
      setShowPopupPanel(false);
      setTimeout(() => {
        setIsExpanded(false);
      }, CLOSE_DELAY);
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
      style={{
        // '--fnx-bar-width': `${expandedWidth}px`,
      } as React.CSSProperties}
    >
      <ContentSection
        className={contentSectionClassName}
        showPopupPanel={showPopupPanel}
        isTopSide={isTopSide}
        isLeftSide={isLeftSide}       
      >
        {currentPopupContent}
      </ContentSection>

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
          onSettingsClick={navigateToSettings}
          darkMode={darkMode}
        />
      </div>
    </div>
  );
};
