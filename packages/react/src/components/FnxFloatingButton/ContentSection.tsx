import { cn } from '../../utils/cn.js';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext.js';
import { MainPage, SettingsPage, TokenListPage } from './pages/index.js';
import { PermitsPage } from './pages/PermitsPage/index.js';

const CONTENT_TRANSITION_DURATION = 150; // Duration in milliseconds for content fade transition

interface ContentSectionProps {
  className?: string;
  contentPadding?: number;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  className,
  contentPadding = 16,
}) => {
  const { currentPage, showPopupPanel, isTopSide, isLeftSide } = useFnxFloatingButtonContext();

  // Page configuration - memoized to prevent recreating on every render
  const pages = useMemo(() => ({
    main: <MainPage />,
    settings: <SettingsPage />,
    tokenlist: <TokenListPage />,
    permits: <PermitsPage />,
  }), []);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(() => pages[currentPage]);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure content height automatically - only when displayedContent or showPopupPanel changes
  useEffect(() => {
    if (contentRef.current && showPopupPanel && !isTransitioning) {
      // Add padding top and bottom (2 * padding)
      const height = contentRef.current.clientHeight + (contentPadding * 2);
      setContentHeight(height);
    }
  }, [displayedContent, showPopupPanel, contentPadding, isTransitioning]);

  // Update content when page changes
  useEffect(() => {
    if (!showPopupPanel) {
      setIsTransitioning(true);
      setTimeout(() => {
        setDisplayedContent(pages[currentPage]);
        setIsTransitioning(false);
      }, CONTENT_TRANSITION_DURATION);
    } else {
      setDisplayedContent(pages[currentPage]);
      setIsTransitioning(false);
    }
  }, [currentPage, showPopupPanel]);

  return (
    <div
      className={cn(
        className,
        'fnx-content-container',
        // bottom-* has popup above (mb-3), top-* has popup below (mt-3)
        isTopSide ? 'mt-3' : 'mb-3',
        'flex'
      )}
      data-left={isLeftSide}
    >
      <div
        className={cn(
          'fnx-content-panel',
          showPopupPanel && 'fnx-glow'
        )}
        data-open={showPopupPanel}
        style={{
          '--fnx-content-height': showPopupPanel ? `${contentHeight}px` : undefined,
          '--fnx-content-padding': `${contentPadding}px`,
        } as React.CSSProperties}
      >
        <div
          ref={contentRef}
          className="fnx-content-inner"
          data-transitioning={isTransitioning}
        >
          {displayedContent}
        </div>
      </div>
    </div>
  );
};

