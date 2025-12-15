import { TbAlertCircle, TbAlertTriangle, TbInfoCircle, TbCircleCheck, TbX } from 'react-icons/tb';
import { HashLink } from './HashLink';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext';
import { cn } from '@/utils';

export type ToastPrimitiveProps = {
  id: string;
  className?: string;
  title: string;
  description?: string;
  transaction?: {
    hash: string;
    chainId: number;
  };
  action?: {
    label: string;
    onClick: () => void;
  };
};

export const ToastPrimitive: React.FC<ToastPrimitiveProps & { icon?: React.ReactNode }> = ({
  id,
  className,
  title,
  description,
  transaction,
  action,
  icon,
}) => {
  const { removeToast } = useFnxFloatingButtonContext();
  return (
    <div className={cn('flex flex-row gap-3 p-2 relative items-center justify-start', className)}>
      {icon != null && icon}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{title}</h3>
        {description != null && <p className="text-xs">{description}</p>}
        {transaction != null && <HashLink type="tx" hash={transaction.hash} chainId={transaction.chainId} />}
      </div>
      <div className="flex-1" />
      {action != null && <button onClick={action.onClick}>{action.label}</button>}
      <button onClick={() => removeToast(id)}>
        <TbX className="text-gray-500 size-4" />
      </button>
    </div>
  );
};

export const InfoToastPrimitive: React.FC<ToastPrimitiveProps> = ({ className, ...props }) => {
  return (
    <ToastPrimitive
      className={cn('bg-blue-50 border-blue-200 text-blue-800', className)}
      icon={<TbInfoCircle className="text-blue-500 size-4" />}
      {...props}
    />
  );
};

export const SuccessToastPrimitive: React.FC<ToastPrimitiveProps> = ({ className, ...props }) => {
  return (
    <ToastPrimitive
      className={cn('bg-green-50 border-green-200 text-green-800', className)}
      icon={<TbCircleCheck className="text-green-500 size-4" />}
      {...props}
    />
  );
};

export const ErrorToastPrimitive: React.FC<ToastPrimitiveProps> = ({ className, ...props }) => {
  return (
    <ToastPrimitive
      className={cn('bg-red-50 border-red-200 text-red-800', className)}
      icon={<TbAlertCircle className="text-red-500 size-4" />}
      {...props}
    />
  );
};

export const WarningToastPrimitive: React.FC<ToastPrimitiveProps> = ({ className, ...props }) => {
  return (
    <ToastPrimitive
      className={cn('bg-yellow-50 border-yellow-200 text-yellow-800', className)}
      icon={<TbAlertTriangle className="text-yellow-500 size-4" />}
      {...props}
    />
  );
};
