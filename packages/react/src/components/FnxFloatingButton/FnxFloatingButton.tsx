import { useState } from 'react';
import type { BaseProps } from '../../types/component-types.js';
import { cn } from '../../utils/cn.js';
import { useCofheContext } from '../../providers';
import { FloatingIcon } from './FloatingIcon.js';
import { StatusBarSection } from './StatusBarSection.js';
import { ContentSection } from './ContentSection.js';
import { MainPage, SettingsPage, TokenListPage } from './pages/index.js';

export type FloatingButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// TODOS:
// - Get svgs instead of pngs
// - Define configuration that needs to move to global react config
// - Improve expand animation so it will roll out from the floating button
// - Create dark mode
// - Create css that contains the styles for the floating button and the content section

// Glow effect constant
export const GLOW_SHADOW = '0 0 6px 0 rgba(10, 217, 220, 0.50)';

export interface FnxFloatingButtonProps extends BaseProps {
  /** Position of the floating button */
  position?: FloatingButtonPosition;
  /** Size of the button in pixels */
  size?: number;
  /** Background color */
  backgroundColor?: string;
  /** Click handler */
  onClick?: () => void;
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
  size = 56,
  backgroundColor = '#DAFEFF',
  onClick,
  darkMode = false,
}) => {
  // Internal constants
  const zIndex = 9999;
  const positionType = 'fixed';
  const expandedWidth = 340;
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
  const borderRadius = size * 0.37;

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
      }, popupDelay);
    } else {
      // Closing: popup first, then bar after popup animation
      setShowPopupPanel(false);
      setTimeout(() => {
        setIsExpanded(false);
      }, 300); // Wait for popup close animation (300ms)
    }

    onClick?.();
  };

  const gapSize = 48; // Gap between button and panel content
  const popupDelay = 500; // Delay before showing popup in ms

  return (
    <div
      data-testid={testId}
      className={cn(
        positionType === 'fixed' ? 'fixed' : 'absolute',
        'flex',
        positionStyles[effectivePosition],
        // bottom-* opens UP (popup above), top-* opens DOWN (popup below)
        isTopSide ? 'flex-col-reverse items-start' : 'flex-col items-start'
      )}
      style={{
        zIndex,
      }}
    >
      <ContentSection
        showPopupPanel={showPopupPanel}
        isTopSide={isTopSide}
        isLeftSide={isLeftSide}
        expandedWidth={expandedWidth}
        gapSize={gapSize}
        size={size}
        backgroundColor={backgroundColor}
        borderRadius={borderRadius}
      >
        {currentPopupContent}
      </ContentSection>

      {/* Button and Bar Row */}
      <div className={cn('flex items-center', isLeftSide ? 'flex-row' : 'flex-row-reverse')}>
        <FloatingIcon
          size={size}
          backgroundColor={backgroundColor}
          borderRadius={borderRadius}
          onClick={handleClick}
          className={className}
          isExpanded={isExpanded}
          darkMode={darkMode}
        />

        <StatusBarSection
          isExpanded={isExpanded}
          expandedWidth={expandedWidth}
          gapSize={gapSize}
          size={size}
          isLeftSide={isLeftSide}
          backgroundColor={backgroundColor}
          borderRadius={borderRadius}
          onSettingsClick={navigateToSettings}
          darkMode={darkMode}
        />
      </div>
    </div>
  );
};
