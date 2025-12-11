import { cn } from '../../utils/cn';
import { useState, useEffect, useRef, useMemo } from 'react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { pages as pagesConfig } from './pagesConfig/const';
import { FloatingButtonPage, type PageState, type FloatingButtonPagePropsMap } from './pagesConfig/types';
import { ShieldPageV2 } from './pages/ShieldPageV2';
import { PermitDetailsPage } from './pages/permits/PermitDetailsPage';
import type { PermitDetailsPageProps } from './pages/permits/PermitDetailsPage/types';
import { useSettingsStore, ShieldPageVariant } from './stores/settingsStore';

const CONTENT_TRANSITION_DURATION = 150; // Duration in milliseconds for content fade transition

interface ContentSectionProps {
  className?: string;
  contentPadding?: number;
  // intended for a case like: bring user to Generate Permit page, without affecting the history stack
  overriddingPage?: PageState;
}

export const ContentSection: React.FC<ContentSectionProps> = ({ className, contentPadding = 16, overriddingPage }) => {
  const { currentPage: pageFromContext, showPopupPanel, isTopSide, isLeftSide } = useFnxFloatingButtonContext();
  const currentPage = overriddingPage ?? pageFromContext;
  const { shieldPageVariant } = useSettingsStore();

  // Determine which shield page to render based on A/B test setting
  const pages = useMemo(() => {
    const ShieldPageComponent =
      shieldPageVariant === ShieldPageVariant.Option2 ? ShieldPageV2 : pagesConfig[FloatingButtonPage.Shield];
    return {
      ...pagesConfig,
      [FloatingButtonPage.Shield]: ShieldPageComponent,
    };
  }, [shieldPageVariant]);

  // Type-safe helper to render a page component
  const renderPageComponent = <K extends FloatingButtonPage>(
    page: K,
    props: FloatingButtonPagePropsMap[K] | undefined
  ): React.ReactElement => {
    // Special handling for PermitDetails page which requires props
    if (page === FloatingButtonPage.PermitDetails) {
      // TypeScript knows props must be PermitDetailsPageProps here
      if (!props) {
        throw new Error('PermitDetails page requires props');
      }
      // Use the specific type instead of the mapped type for better type safety
      return <PermitDetailsPage {...(props as PermitDetailsPageProps)} />;
    }

    // All other pages don't require props (void type)
    // Use type assertion to tell TypeScript these components accept no props
    const PageComp = pages[page] as React.ComponentType<Record<string, never>>;
    return <PageComp />;
  };

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(() =>
    renderPageComponent(currentPage.page, currentPage.props)
  );
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

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
    function renderPage() {
      setDisplayedContent(renderPageComponent(currentPage.page, currentPage.props));
      setIsTransitioning(false);
    }
    if (!showPopupPanel) {
      setIsTransitioning(true);
      setTimeout(() => {
        renderPage();
      }, CONTENT_TRANSITION_DURATION);
    } else {
      renderPage();
    }
  }, [currentPage, showPopupPanel, pages]);

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
      data-open={showPopupPanel}
    >
      <div
        className={cn('fnx-content-panel')}
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
