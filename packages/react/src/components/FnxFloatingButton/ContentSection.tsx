import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { pages } from './pagesConfig/const';
import { type PageState } from './pagesConfig/types';
import { type PortalModalState } from './modals/types';
import { AnimatePresence, motion } from 'motion/react';
import { AnimatedZStack } from '../primitives/AnimatedZStack';
import { modals } from './modals';
import { usePortalUI, usePortalCurrentPage, usePortalUIMaxContentHeight, usePortalModals } from '@/stores';
import { cn } from '@/utils';

interface ContentSectionProps {
  overriddingPage?: PageState;
}

const MeasuredContentRenderer: React.FC<{
  children?: ReactNode;
  id: string;
  isModal?: boolean;
  onModalOverlayClick?: () => void;
}> = ({ children, id, isModal, onModalOverlayClick }) => {
  const { setContentHeight, removeContentHeight } = usePortalUI();
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
    return () => {
      observer.disconnect();
      removeContentHeight(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <>
      {isModal && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onModalOverlayClick?.();
          }}
          className="absolute flex w-full h-full bg-[#0E2F3F]/30 origin-top translate-y-[-8px] scale-[0.95]"
        />
      )}
      <div className="relative flex w-full h-full overflow-y-hidden pointer-events-none">
        <div className={cn('fnx-panel absolute flex left-0 w-full p-4 top-0 pointer-events-auto')} ref={contentRef}>
          {children}
        </div>
      </div>
    </>
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

const ModalRenderer: React.FC<{ modal: PortalModalState }> = ({ modal }) => {
  const content = useMemo(() => {
    const ModalComp = modals[modal.modal] as React.FC<typeof modal>;
    return <ModalComp {...modal} />;
  }, [modal]);

  return (
    <MeasuredContentRenderer id={`${modal.modal}-modal`} isModal onModalOverlayClick={modal.onClose}>
      {content}
    </MeasuredContentRenderer>
  );
};

export const ContentSection: React.FC<ContentSectionProps> = ({ overriddingPage }) => {
  const { isTopSide } = useFnxFloatingButtonContext();
  const { contentPanelOpen } = usePortalUI();
  const { modalStack } = usePortalModals();
  const maxContentHeight = usePortalUIMaxContentHeight();
  const currentPage = usePortalCurrentPage();
  const pageOrOverridingPage = overriddingPage ?? currentPage;

  return (
    <AnimatePresence>
      {contentPanelOpen && (
        <motion.div
          className="relative flex w-full z-50"
          initial={{ opacity: 0, y: isTopSide ? -10 : 10 }}
          animate={{ opacity: 1, y: 0, height: `${maxContentHeight}px`, maxHeight: `${maxContentHeight}px` }}
          exit={{ opacity: 0, y: isTopSide ? -10 : 10 }}
        >
          <AnimatedZStack>
            <ContentRenderer page={pageOrOverridingPage} />
            {modalStack.map((modal) => {
              return <ModalRenderer key={modal.modal} modal={modal} />;
            })}
          </AnimatedZStack>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
