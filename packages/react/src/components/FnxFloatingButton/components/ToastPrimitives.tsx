import { TbAlertCircle, TbAlertTriangle, TbInfoCircle, TbCircleCheck, TbCircleX } from 'react-icons/tb';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { HashLink } from './HashLink';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext';
import { cn } from '@/utils';
import type { FhxFloatingButtonToastVariant, FnxFloatingButtonToastByFunctionParams } from '../types';

export type ToastPrimitiveProps = FnxFloatingButtonToastByFunctionParams & {
  id?: string;
  paused?: boolean;
  startMs?: number;
  remainingMs?: number;
  className?: string;
};

export const FNX_DEFAULT_TOAST_DURATION = 5000;

const variantIconMap: Record<FhxFloatingButtonToastVariant, React.ReactNode> = {
  info: <TbInfoCircle className="text-blue-500 size-5" />,
  success: <TbCircleCheck className="text-green-500 size-5" />,
  error: <TbAlertCircle className="text-red-500 size-5" />,
  warning: <TbAlertTriangle className="text-yellow-500 size-5" />,
};

const variantClassNameMap: Record<FhxFloatingButtonToastVariant, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

const variantProgressBarColorMap: Record<FhxFloatingButtonToastVariant, string> = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
};

const ToastCloseButton: React.FC<{ id?: string }> = ({ id }) => {
  const { removeToast } = useFnxFloatingButtonContext();
  if (!id) return null;
  return (
    <button onClick={() => removeToast(id)}>
      <TbCircleX className="text-gray-500 size-5" />
    </button>
  );
};

const ToastActionButton: React.FC<Pick<ToastPrimitiveProps, 'id' | 'action'>> = ({ id, action }) => {
  const { removeToast } = useFnxFloatingButtonContext();
  if (action == null || !id) return null;
  return (
    <button
      onClick={() => {
        removeToast(id);
        action.onClick();
      }}
    >
      {action.label}
    </button>
  );
};

const ToastDurationIndicator: React.FC<{
  duration: number;
  remainingMs?: number;
  paused?: boolean;
  variant?: FhxFloatingButtonToastVariant;
}> = ({ duration, remainingMs, paused = false, variant }) => {
  if (variant == null || remainingMs == null || remainingMs <= 0) return null;

  const progress = remainingMs / duration;
  const progressColor = variantProgressBarColorMap[variant];

  return (
    <div className="absolute bottom-0 left-0 w-full h-1 overflow-hidden">
      {paused ? (
        <div className={cn(progressColor, 'h-full origin-right')} style={{ transform: `scaleX(${progress})` }} />
      ) : (
        <motion.div
          className={`h-full ${progressColor} origin-right`}
          initial={{ scaleX: progress }}
          animate={{ scaleX: 0 }}
          transition={{
            duration: remainingMs / 1000,
            ease: 'linear',
          }}
        />
      )}
    </div>
  );
};

export const ToastPrimitiveBase: React.FC<{
  id?: string;
  paused?: boolean;
  duration?: number | 'infinite';
  remainingMs?: number;
  className?: string;
  variant?: FhxFloatingButtonToastVariant;
  children?: React.ReactNode;
}> = ({ id, duration, remainingMs, className, variant, paused, children }) => {
  const { pauseToast } = useFnxFloatingButtonContext();

  return (
    <div
      className={cn(
        'flex flex-row gap-3 p-2 relative items-center justify-start pb-3',
        variant != null && variantClassNameMap[variant],
        className
      )}
      onMouseEnter={() => {
        if (id == null) return;
        pauseToast(id, true);
      }}
      onMouseLeave={() => {
        if (id == null) return;
        pauseToast(id, false);
      }}
    >
      {variant != null && variantIconMap[variant]}
      {children}
      <ToastCloseButton id={id} />
      {duration !== 'infinite' && (
        <ToastDurationIndicator
          duration={duration ?? FNX_DEFAULT_TOAST_DURATION}
          remainingMs={remainingMs}
          paused={paused}
          variant={variant}
        />
      )}
    </div>
  );
};

const ToastContent: React.FC<Pick<ToastPrimitiveProps, 'id' | 'title' | 'description' | 'transaction' | 'action'>> = ({
  id,
  title,
  description,
  transaction,
  action,
}) => {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{title}</h3>
        {description != null && <p className="text-xs">{description}</p>}
        {transaction != null && <HashLink type="tx" hash={transaction.hash} chainId={transaction.chainId} />}
      </div>
      <div className="flex-1" />
      <ToastActionButton id={id} action={action} />
    </>
  );
};

export const ToastPrimitive: React.FC<ToastPrimitiveProps> = (props) => {
  return (
    <ToastPrimitiveBase {...props}>
      <ToastContent {...props} />
    </ToastPrimitiveBase>
  );
};
