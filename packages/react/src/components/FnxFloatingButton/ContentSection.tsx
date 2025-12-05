import { cn } from '../../utils/cn.js';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  MainPage,
  SettingsPage,
  TokenListPage,
  SendPage,
  ShieldPage,
  ActivityPage,
  GeneratePermitPage,
  ReceivePermitPage,
  PermitsListPage,
  PermitDetailsPage,
} from './pages/index.js';
import { FloatingButtonPage, useFnxFloatingButtonContext } from './FnxFloatingButtonContext.js';

const CONTENT_TRANSITION_DURATION = 150; // Duration in milliseconds for content fade transition

interface ContentSectionProps {
  className?: string;
  contentPadding?: number;
}

export const ContentSection: React.FC<ContentSectionProps> = ({ className, contentPadding = 0 }) => {
  const { currentPage, showPopupPanel, isTopSide, isLeftSide } = useFnxFloatingButtonContext();

  // Page configuration - memoized to prevent recreating on every render
  const pages = useMemo(
    () => ({
      [FloatingButtonPage.Main]: <MainPage />,
      [FloatingButtonPage.Settings]: <SettingsPage />,
      [FloatingButtonPage.TokenList]: <TokenListPage />,
      [FloatingButtonPage.Send]: <SendPage />,
      [FloatingButtonPage.Shield]: <ShieldPage />,
      [FloatingButtonPage.Activity]: <ActivityPage />,
      [FloatingButtonPage.Permits]: <PermitsListPage />,
      [FloatingButtonPage.GeneratePermits]: <GeneratePermitPage />,
      [FloatingButtonPage.ReceivePermits]: <ReceivePermitPage />,
      [FloatingButtonPage.PermitDetails]: <PermitDetailsPage />,
    }),
    []
  );

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(() => pages[currentPage]);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure content height automatically - only when displayedContent or showPopupPanel changes
  useEffect(() => {
    if (contentRef.current && showPopupPanel && !isTransitioning) {
      // Add padding top and bottom (2 * padding)
      const height = contentRef.current.clientHeight + contentPadding * 2;
      setContentHeight(height);
    }
  }, [displayedContent, showPopupPanel, contentPadding, isTransitioning]);

  // React to dynamic size changes inside the active page (e.g., toggling fields)
  useEffect(() => {
    if (!showPopupPanel) return;
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height + contentPadding * 2;
        setContentHeight((prev) => (prev !== newHeight ? newHeight : prev));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showPopupPanel, contentPadding]);

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
        className={cn('fnx-content-panel', showPopupPanel && 'fnx-glow')}
        data-open={showPopupPanel}
        style={
          {
            '--fnx-content-height': showPopupPanel ? `${contentHeight}px` : undefined,
            '--fnx-content-padding': `${contentPadding}px`,
          } as React.CSSProperties
        }
      >
        <div ref={contentRef} className="fnx-content-inner" data-transitioning={isTransitioning}>
          {displayedContent}
        </div>
      </div>
    </div>
  );
};
