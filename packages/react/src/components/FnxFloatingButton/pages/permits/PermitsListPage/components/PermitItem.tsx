import type { PermitStatus } from '@/hooks/permits/index.js';
import { ValidationUtils, type Permit } from '@cofhe/sdk/permits';
import type { FC, ReactNode } from 'react';

const statusStyles: Record<PermitStatus, string> = {
  active: 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/50',
  expired: 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50',
};

interface PermitItemProps {
  permit: Permit;
  hash: string;
  onSelect?: (id: string) => void;
  children?: ReactNode;
}

export const PermitItem: FC<PermitItemProps> = ({ permit, onSelect, children, hash }) => {
  const status: PermitStatus = ValidationUtils.isExpired(permit) ? 'expired' : 'active';
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-2 pl-3">
      <span
        className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium ${statusStyles[status]}`}
      >
        {status === 'active' ? 'Active' : 'Expired'}
      </span>
      {onSelect ? (
        <button
          type="button"
          className="min-w-0 w-full truncate text-left text-sm font-medium fnx-text-primary transition-colors hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0E2F3F]/30"
          title={permit.name}
          aria-label={permit.name}
          onClick={() => onSelect(hash)}
        >
          {permit.name}
        </button>
      ) : (
        <span
          className="min-w-0 truncate text-sm font-medium fnx-text-primary"
          title={permit.name}
          aria-label={permit.name}
        >
          {permit.name}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-1.5 fnx-text-primary">{children}</div>
    </div>
  );
};
