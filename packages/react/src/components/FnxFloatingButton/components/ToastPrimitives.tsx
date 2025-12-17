import { TbAlertTriangle, TbInfoCircle, TbCircleCheck, TbX } from 'react-icons/tb';
import { motion } from 'motion/react';
import { HashLink } from './HashLink';
import { cn } from '@/utils';
import type { FnxToastVariant, FnxToastImperativeParams, FnxToastInjectedProps } from '../types';

export type ToastPrimitiveProps = FnxToastImperativeParams & FnxToastInjectedProps;

const variantIconMap: Record<FnxToastVariant, React.ReactNode> = {
  info: <TbInfoCircle className="text-blue-500 size-5" />,
  success: <TbCircleCheck className="text-green-500 size-5" />,
  error: <TbAlertTriangle className="text-red-500 size-5" />,
  warning: <TbAlertTriangle className="text-yellow-500 size-5" />,
};

const variantClassNameMap: Record<FnxToastVariant, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

const variantProgressBarColorMap: Record<FnxToastVariant | 'base', string> = {
  base: 'bg-gray-500',
  info: 'bg-blue-500',
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
};

const ToastCloseButton: React.FC<Pick<ToastPrimitiveProps, 'onDismiss'>> = ({ onDismiss }) => {
  return (
    <button className="self-start" onClick={() => onDismiss?.()}>
      <TbX className="text-gray-500 size-5" />
    </button>
  );
};

const ToastActionButton: React.FC<Pick<ToastPrimitiveProps, 'action' | 'onDismiss'>> = ({ action, onDismiss }) => {
  if (action == null) return null;

  return (
    <button
      onClick={() => {
        onDismiss?.();
        action.onClick();
      }}
    >
      {action.label}
    </button>
  );
};

const ToastDurationIndicator: React.FC<
  Pick<ToastPrimitiveProps, 'duration' | 'remainingMs' | 'paused' | 'variant'>
> = ({ duration, remainingMs, paused, variant }) => {
  if (remainingMs == null || remainingMs <= 0 || duration == null || duration === 'infinite') return null;

  const progress = remainingMs / duration;
  const progressColor = variantProgressBarColorMap[variant ?? 'base'];

  return (
    <div className="absolute bottom-0 left-0 w-full h-1 overflow-hidden">
      {paused ? (
        <div className={cn(progressColor, 'h-full origin-right')} style={{ transform: `scaleX(${progress})` }} />
      ) : (
        <motion.div
          className={cn('h-full origin-right', progressColor)}
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

export const ToastPrimitiveBase: React.FC<
  FnxToastInjectedProps & { variant?: FnxToastVariant; children: React.ReactNode }
> = ({ id, duration, remainingMs, variant, paused, children, onPause, onDismiss }) => {
  return (
    <div
      className={cn(
        'flex flex-row gap-3 p-2 relative items-center justify-start pb-3',
        variant != null && variantClassNameMap[variant]
      )}
      onMouseEnter={() => {
        if (id == null) return;
        onPause?.(true);
      }}
      onMouseLeave={() => {
        if (id == null) return;
        onPause?.(false);
      }}
    >
      {variant != null && variantIconMap[variant]}
      <div className="flex-1">{children}</div>
      <ToastCloseButton onDismiss={onDismiss} />
      {duration !== 'infinite' && (
        <ToastDurationIndicator duration={duration} remainingMs={remainingMs} paused={paused} variant={variant} />
      )}
    </div>
  );
};

const ToastContent: React.FC<
  Pick<ToastPrimitiveProps, 'title' | 'description' | 'transaction' | 'action' | 'onDismiss'>
> = ({ title, description, transaction, action, onDismiss }) => {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{title}</h3>
        {description != null && <p className="text-xs">{description}</p>}
        {transaction != null && <HashLink type="tx" hash={transaction.hash} chainId={transaction.chainId} />}
      </div>
      <div className="flex-1" />
      <ToastActionButton action={action} onDismiss={onDismiss} />
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
