import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { type PageState } from './pagesConfig/types';
import { AnimatePresence, motion } from 'motion/react';
import { pages } from './pagesConfig/const';
import { AnimatedZStack } from '../primitives/AnimatedZStack';

interface ContentSectionProps {
  overriddingPage?: PageState;
}

const MeasuredContentRenderer: React.FC<{ children?: ReactNode; id: string }> = ({ children, id }) => {
  const { setContentHeight } = useFnxFloatingButtonContext();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        setContentHeight(id, height);
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [id, setContentHeight]);

  return (
    <div className="fnx-panel relative flex w-full h-full overflow-y-auto">
      <div className="absolute flex top-0 left-0 w-full p-4" ref={contentRef}>
        {children}
      </div>
    </div>
  );
};

const ContentRenderer: React.FC<{ page: PageState }> = ({ page }) => {
  const content = useMemo(() => {
    const PageComp = pages[page.page];
    const props = page.props ?? {};
    return <PageComp {...props} />;
  }, [page]);

  return <MeasuredContentRenderer id="content">{content}</MeasuredContentRenderer>;
};

const ModalRenderer: React.FC<{ page: PageState }> = ({ page }) => {
  const content = useMemo(() => {
    const PageComp = pages[page.page];
    const props = page.props ?? {};
    return <PageComp {...props} />;
  }, [page]);

  return <MeasuredContentRenderer id={`${page.page}-modal`}>{content}</MeasuredContentRenderer>;
};

export const ContentSection: React.FC<ContentSectionProps> = ({ overriddingPage }) => {
  const {
    currentPage: pageFromContext,
    contentPanelOpen,
    isTopSide,
    maxContentHeight,
    modalStack,
  } = useFnxFloatingButtonContext();
  const currentPage = overriddingPage ?? pageFromContext;

  return (
    <AnimatePresence>
      {contentPanelOpen && (
        <motion.div
          className="relative flex w-full"
          initial={{ opacity: 0, y: isTopSide ? -10 : 10 }}
          animate={{ opacity: 1, y: 0, height: `${maxContentHeight}px`, maxHeight: `${maxContentHeight}px` }}
          exit={{ opacity: 0, y: isTopSide ? -10 : 10 }}
        >
          <AnimatedZStack>
            <ContentRenderer page={currentPage} />
            {modalStack.map((modal) => {
              return <ModalRenderer page={modal} key={modal.page} />;
            })}
          </AnimatedZStack>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
