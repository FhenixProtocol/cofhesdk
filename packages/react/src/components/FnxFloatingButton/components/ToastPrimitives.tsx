import { TbAlertCircle, TbAlertTriangle, TbInfoCircle, TbCircleCheck, TbCircleX } from 'react-icons/tb';
import { HashLink } from './HashLink';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext';
import { cn } from '@/utils';
import type { FhxFloatingButtonToastVariant, FnxFloatingButtonToastContentProps } from '../types';

export type ToastPrimitiveProps = FnxFloatingButtonToastContentProps & {
  id: string;
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

const ToastCloseButton: React.FC<{ id: string }> = ({ id }) => {
  const { removeToast } = useFnxFloatingButtonContext();
  return (
    <button onClick={() => removeToast(id)}>
      <TbCircleX className="text-gray-500 size-5" />
    </button>
  );
};

const ToastActionButton: React.FC<Pick<ToastPrimitiveProps, 'id' | 'action'>> = ({ id, action }) => {
  const { removeToast } = useFnxFloatingButtonContext();
  if (action == null) return null;
  return <button onClick={() => action.onClick(() => removeToast(id))}>{action.label}</button>;
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

export const ToastPrimitiveBase: React.FC<{
  id: string;
  className?: string;
  variant?: FhxFloatingButtonToastVariant;
  children?: React.ReactNode;
}> = ({ id, className, variant, children }) => {
  return (
    <div
      className={cn(
        'flex flex-row gap-3 p-2 relative items-center justify-start',
        variant != null && variantClassNameMap[variant],
        className
      )}
    >
      {variant != null && variantIconMap[variant]}
      {children}
      <ToastCloseButton id={id} />
    </div>
  );
};

export const ToastPrimitive: React.FC<ToastPrimitiveProps & { variant?: FhxFloatingButtonToastVariant }> = (props) => {
  return (
    <ToastPrimitiveBase {...props}>
      <ToastContent {...props} />
    </ToastPrimitiveBase>
  );
};
