import type { PermitRow, PermitStatus } from '@/hooks/permits/index.js';
import type { FC, ReactNode } from 'react';

const statusStyles: Record<PermitStatus, string> = {
  active: 'bg-[#01D082] text-[#0D3547] border border-[#068571]',
  expired: 'bg-[#F0784F] text-[#4A1004] border border-[#A1421F]',
};

interface PermitItemProps {
  permit: PermitRow;
  onSelect?: (id: string) => void;
  children?: ReactNode;
}

export const PermitItem: FC<PermitItemProps> = ({ permit, onSelect, children }) => {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 pl-4">
      <span
        className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-semibold ${statusStyles[permit.status]}`}
      >
        {permit.status === 'active' ? 'Active' : 'Expired'}
      </span>
      {onSelect ? (
        <button
          type="button"
          className="min-w-0 w-full truncate text-left text-base font-medium text-[#0E2F3F] transition-colors hover:text-[#0E2F3F]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0E2F3F]/30 dark:text-white dark:hover:text-white/80"
          title={permit.name}
          aria-label={permit.name}
          onClick={() => onSelect(permit.id)}
        >
          {permit.name}
        </button>
      ) : (
        <span
          className="min-w-0 truncate text-base font-medium text-[#0E2F3F] dark:text-white"
          title={permit.name}
          aria-label={permit.name}
        >
          {permit.name}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-2 text-[#0E2F3F] dark:text-white">{children}</div>
    </div>
  );
};
