import { MdOutlineSettings } from 'react-icons/md';
import { IoIosCheckmarkCircleOutline } from 'react-icons/io';
import { cn } from '@/utils';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FloatingButtonPage } from './pagesConfig/types';
import { FhenixLogoIcon } from '../FhenixLogoIcon';
import type { FnxStatus, FnxStatusVariant } from './types';
import { type ReactNode, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const CARD_OFFSET = 8;
const SCALE_FACTOR = 0.05;

const StackWrapper: React.FC<{ children?: ReactNode; index: number; length: number; className?: string }> = ({
  children,
  index,
  length,
  className,
}) => {
  // Default status is always index 0, its animation in and out doesn't involve translation
  // Active statuses animate in from the bottom and out to the bottom
  const isDefaultStatus = index === 0;
  const initial = isDefaultStatus
    ? {
        opacity: 0,
      }
    : {
        opacity: 0,
        top: CARD_OFFSET,
        scale: 1 + SCALE_FACTOR,
      };

  // invIndex is the depth of the card in the stack, as the length of the stack increases, the depth of the card decreases
  // Deeper items scale down and move up
  const invIndex = length - index - 1;

  return (
    <motion.div
      className={cn(
        'fnx-panel w-full h-full flex px-4 items-center justify-between absolute origin-top',
        invIndex === 0 && 'events-none',
        className
      )}
      initial={initial}
      exit={initial}
      animate={{
        opacity: 1,
        top: invIndex * -CARD_OFFSET,
        scale: 1 - invIndex * SCALE_FACTOR,
        zIndex: index,
      }}
    >
      {children}
    </motion.div>
  );
};

const DefaultStatusContent: React.FC<{ length: number }> = ({ length }) => {
  const { navigateTo, theme } = useFnxFloatingButtonContext();

  return (
    <StackWrapper index={0} length={length}>
      {/* Logo Icon */}
      <FhenixLogoIcon theme={theme} className="w-10 h-10" />

      {/* Status */}
      <div className="flex items-center gap-1 ml-auto mr-2">
        <IoIosCheckmarkCircleOutline className="text-green-500" />
        <span className="font-medium">Connected*</span>
      </div>

      {/* Settings Icon */}
      <button
        onClick={() => navigateTo(FloatingButtonPage.Settings)}
        className={cn('p-1 rounded fnx-hover-overlay transition-colors', 'fnx-text-primary')}
      >
        <MdOutlineSettings className="w-4 h-4" />
      </button>
    </StackWrapper>
  );
};

const statusTextColorMap: Record<FnxStatusVariant, string> = {
  error: 'text-red-500',
  warning: 'text-yellow-500',
};

const ActiveStatusContent: React.FC<{ status: FnxStatus; index: number; length: number }> = ({
  status,
  index,
  length,
}) => {
  const { theme } = useFnxFloatingButtonContext();

  return (
    <StackWrapper
      index={index}
      length={length}
      className={cn(
        status.variant === 'error' && 'border-red-500',
        status.variant === 'warning' && 'border-yellow-500'
      )}
    >
      {/* Logo Icon */}
      <FhenixLogoIcon theme={theme} className="w-10 h-10" />

      {/* Status Info */}
      <div className="flex flex-col ml-2 mr-auto">
        <h3 className={cn('text-sm font-medium', statusTextColorMap[status.variant])}>{status.title}</h3>
        {status.description != null && (
          <p className={cn('text-xs', statusTextColorMap[status.variant])}>{status.description}</p>
        )}
      </div>

      {/* Action Button */}
      {status.action != null && (
        <button
          onClick={status.action?.onClick}
          className={cn('p-1 rounded fnx-hover-overlay transition-colors', 'fnx-text-primary')}
        >
          {status.action.label}
        </button>
      )}
    </StackWrapper>
  );
};

export const StatusBarContent: React.FC = () => {
  const { status } = useFnxFloatingButtonContext();
  const length = status != null ? 2 : 1;

  return (
    <AnimatePresence>
      <DefaultStatusContent key="default" length={length} />
      {status != null && <ActiveStatusContent key="active" status={status} index={1} length={length} />}
    </AnimatePresence>
  );
};
