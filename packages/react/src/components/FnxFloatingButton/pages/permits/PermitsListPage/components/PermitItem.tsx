import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import type { PermitRow, PermitStatus } from '@/hooks/permits/index.js';
import React from 'react';

const actionIconMap = {
  copy: ContentCopyIcon,
  delete: DeleteOutlineIcon,
  refresh: AutorenewIcon,
};

const actionLabels = {
  copy: 'Copy permit',
  delete: 'Remove permit',
  refresh: 'Regenerate permit',
};

const statusStyles: Record<PermitStatus, string> = {
  active: 'bg-[#01D082] text-[#0D3547] border border-[#068571]',
  expired: 'bg-[#F0784F] text-[#4A1004] border border-[#A1421F]',
};

interface PermitItemProps {
  permit: PermitRow;
  onAction: (action: PermitRow['actions'][number], id: string) => void;
  isCopied?: (id: string) => boolean;
}

export const PermitItem: React.FC<PermitItemProps> = ({ permit, onAction, isCopied }) => {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 pl-4">
      <span
        className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-semibold ${statusStyles[permit.status]}`}
      >
        {permit.status === 'active' ? 'Active' : 'Expired'}
      </span>
      <span
        className="min-w-0 truncate text-base font-medium text-[#0E2F3F] dark:text-white"
        title={permit.name}
        aria-label={permit.name}
      >
        {permit.name}
      </span>
      <div className="flex shrink-0 items-center gap-2 text-[#0E2F3F] dark:text-white">
        {permit.actions.map((action) => {
          const Icon = actionIconMap[action];
          const copiedState = action === 'copy' && isCopied?.(permit.id);
          return (
            <button
              key={action}
              className="rounded-md border border-[#0E2F3F]/40 p-1.5 transition-colors hover:bg-[#0E2F3F]/10 dark:border-white/40 dark:hover:bg-white/10"
              aria-label={copiedState ? 'Copied!' : actionLabels[action]}
              type="button"
              title={copiedState ? 'Copied!' : actionLabels[action]}
              disabled={Boolean(copiedState)}
              onClick={() => onAction(action, permit.id)}
            >
              {copiedState ? <CheckIcon fontSize="small" color="success" /> : <Icon fontSize="small" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
