import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import { useCallback, useMemo } from 'react';
import { ValidationUtils } from '@cofhe/sdk/permits';
import { useCofheAllPermits, useCofheRemovePermit } from '../../../../hooks';
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext.js';
import { Accordion, AccordionSection } from '../../Accordion.js';

type PermitStatus = 'active' | 'expired';

interface PermitRow {
  id: string;
  name: string;
  status: PermitStatus;
  actions: Array<'copy' | 'delete' | 'refresh'>;
}

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

const quickActions = [
  {
    id: 'generate',
    label: 'Generate / Delegate',
    icon: NorthIcon,
  },
  {
    id: 'receive',
    label: 'Receive',
    icon: SouthIcon,
  },
];

export const PermitsListPage: React.FC = () => {
  const allPermits = useCofheAllPermits();
  const removePermit = useCofheRemovePermit();
  const { navigateBack, navigateToGeneratePermit, navigateToReceivePermit } = useFnxFloatingButtonContext();

  const generatedPermits = useMemo<PermitRow[]>(() => {
    return allPermits.map(({ hash, permit }) => {
      const status: PermitStatus = ValidationUtils.isExpired(permit) ? 'expired' : 'active';
      const actions: PermitRow['actions'] = [];
      if (status === 'active') {
        if (permit.type === 'sharing') actions.push('copy');
      } else {
        actions.push('refresh');
      }
      actions.push('delete');
      return {
        id: hash,
        name: permit.name,
        status,
        actions,
      };
    });
  }, [allPermits]);

  const handleQuickAction = (actionId: string) => {
    if (actionId === 'generate') {
      navigateToGeneratePermit();
      return;
    }
    if (actionId === 'receive') {
      navigateToReceivePermit();
    }
  };

  const handleGeneratedPermitAction = useCallback(
    (action: PermitRow['actions'][number], permitId: string) => {
      if (action === 'delete') {
        removePermit(permitId);
      }
    },
    [removePermit]
  );

  return (
    <div className="fnx-text-primary text-sm">
      <div className="rounded-2xl border border-[#154054] bg-white p-5 shadow-[0_25px_60px_rgba(13,53,71,0.15)] transition-colors dark:border-[#2C6D80] dark:bg-[#1F1F1F]">
        <div className="flex items-center justify-between pb-4">
          <button
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
            onClick={navigateBack}
            type="button"
          >
            <ArrowBackIcon fontSize="small" />
            <span>Permit list</span>
          </button>
        </div>

        <div className="space-y-6 pt-2">
          <Accordion defaultActiveId="generated">
            <AccordionSection
              id="generated"
              triggerClassName="flex w-full items-center justify-between text-left text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
              contentClassName="relative mt-4 pl-4"
              renderHeader={(isOpen) => (
                <>
                  <span>Generated:</span>
                  {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                </>
              )}
            >
              <span
                className="absolute left-1 top-0 bottom-0 border-l border-[#0E2F3F]/30 dark:border-white/40"
                aria-hidden
              />
              {generatedPermits.length === 0 ? (
                <div className="pl-4 text-sm text-[#0E2F3F]/70 dark:text-white/80">No permits yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {generatedPermits.map((permit) => (
                    <div key={permit.id} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 pl-4">
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
                          return (
                            <button
                              key={action}
                              className="rounded-md border border-[#0E2F3F]/40 p-1.5 transition-colors hover:bg-[#0E2F3F]/10 dark:border-white/40 dark:hover:bg-white/10"
                              aria-label={actionLabels[action]}
                              type="button"
                              onClick={() => handleGeneratedPermitAction(action, permit.id)}
                            >
                              <Icon fontSize="small" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionSection>

            <AccordionSection
              id="received"
              triggerClassName="flex w-full items-center justify-between text-left text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
              contentClassName="mt-4"
              renderHeader={(isOpen) => (
                <>
                  <span>Received</span>
                  {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                </>
              )}
            >
              TODO
            </AccordionSection>
          </Accordion>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0E2F3F] px-4 py-3 text-base font-semibold text-[#0E2F3F] transition-colors hover:bg-[#0E2F3F]/5 dark:border-white/60 dark:text-white dark:hover:bg-white/5"
                onClick={() => handleQuickAction(id)}
              >
                <Icon fontSize="small" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
