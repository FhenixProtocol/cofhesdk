import { cn } from '@/utils';
import { type ReactNode } from 'react';

interface PageContainerProps {
  /** Whether the page is a modal */
  isModal?: boolean;
  /** Optional header component that will be fixed at the top */
  header?: ReactNode;
  /** Body content that will be scrollable if it overflows */
  content?: ReactNode;
  /** Optional footer component that will be pinned to the bottom */
  footer?: ReactNode;
}

/**
 * PageContainer provides a consistent layout structure for pages with:
 * - Optional header (fixed at top)
 * - Scrollable body content
 * - Optional footer (pinned at bottom)
 * - Max height of 500px, but shrinks to fit content when smaller
 */
export const PageContainer: React.FC<PageContainerProps> = ({ isModal, header, content, footer }) => {
  return (
    <div className={cn('flex flex-col max-h-[500px] w-full gap-4', isModal ? '' : 'h-full')}>
      {/* Header - fixed at top, doesn't scroll */}
      {header && <div className="flex-shrink-0">{header}</div>}

      {/* Body - scrollable middle section that fills available space */}
      {content && <div className="flex-1 min-h-0 overflow-y-auto">{content}</div>}

      {/* Footer - fixed at bottom, doesn't scroll */}
      {footer && <div className="flex-shrink-0">{footer}</div>}
    </div>
  );
};
