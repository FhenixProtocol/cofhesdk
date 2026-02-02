import type { PermitStatus } from '@/hooks/permits/index.js';
import { ValidationUtils, type Permit } from '@cofhe/sdk/permits';
import type { FC, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/FnxFloatingButton/components';

const statusStyles: Record<PermitStatus, string> = {
  active: 'bg-[#01D082] text-[#0D3547] border border-[#068571]',
  valid: 'bg-[#247AFF] text-white border border-[#247AFF]',
  expired: 'bg-[#F0784F] text-[#4A1004] border border-[#A1421F]',
};

const statusToLabel: Record<PermitStatus, string> = {
  active: 'Active',
  valid: 'Valid',
  expired: 'Expired',
};

interface PermitItemProps {
  permit: Permit;
  hash: string;
  activePermitHash?: string;
  onSelect?: (id: string) => void;
  children?: ReactNode;
}

export const PermitItem: FC<PermitItemProps> = ({ permit, onSelect, children, hash, activePermitHash }) => {
  const status: PermitStatus = ValidationUtils.isExpired(permit)
    ? 'expired'
    : hash === activePermitHash
      ? 'active'
      : 'valid';

  return (
    <Button
      variant="ghost"
      className="flex flex-row w-full items-centera !justify-start gap-3 p-0.5"
      onClick={() => onSelect?.(hash)}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center px-1 py-1 text-sm font-semibold h-6 w-24',
          statusStyles[status]
        )}
      >
        {statusToLabel[status]}
      </span>
      {permit.name}
    </Button>
  );
};
