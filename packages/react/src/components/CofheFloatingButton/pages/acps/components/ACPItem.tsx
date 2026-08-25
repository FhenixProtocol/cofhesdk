import type { ACPStatus } from '@/hooks/acps/index.js';
import { ValidationUtils, type ACP } from '@cofhe/sdk/acps';
import type { FC } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/CofheFloatingButton/components';

const statusStyles: Record<ACPStatus, string> = {
  active: 'bg-[#01D082] text-[#0D3547] border border-[#068571]',
  valid: 'bg-[#247AFF] text-white border border-[#247AFF]',
  expired: 'bg-[#F0784F] text-[#4A1004] border border-[#A1421F]',
};

const statusToLabel: Record<ACPStatus, string> = {
  active: 'Active',
  valid: 'Valid',
  expired: 'Expired',
};

interface ACPItemProps {
  acp: ACP;
  activeACPHash?: string;
  onClick?: (id: string) => void;
}

export const ACPItem: FC<ACPItemProps> = ({ acp, onClick, activeACPHash }) => {
  const status: ACPStatus = ValidationUtils.isExpired(acp)
    ? 'expired'
    : acp.hash === activeACPHash
      ? 'active'
      : 'valid';

  return (
    <Button
      variant="ghost"
      className="flex flex-row w-full items-centera !justify-start gap-3 p-0.5"
      onClick={() => onClick?.(acp.hash)}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center px-1 py-1 text-sm font-semibold h-6 w-24',
          statusStyles[status]
        )}
      >
        {statusToLabel[status]}
      </span>
      {acp.name}
    </Button>
  );
};
