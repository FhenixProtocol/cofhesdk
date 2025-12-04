import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import type { ElementType } from 'react';
import { Accordion, AccordionSection } from '../../../Accordion.js';
import { PermitItem } from './components/PermitItem';
import { usePermitsList } from '../../../../../hooks/permits/index.js';
import type { PermitRow, PermitStatus, QuickActionId } from '../../../../../hooks/permits/index.js';

type QuickAction = { id: QuickActionId; label: string; icon: ElementType };

const quickActions: QuickAction[] = [
  { id: 'generate', label: 'Generate / Delegate', icon: NorthIcon },
  { id: 'receive', label: 'Receive', icon: SouthIcon },
];

export const PermitsListPage: React.FC = () => {
  const {
    generatedPermits,
    receivedPermits,
    isCopied,
    handleQuickAction,
    handleGeneratedPermitAction,
    handleReceivedPermitDelete,
    navigateBack,
  } = usePermitsList();

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
              renderHeader={(isOpen: boolean) => (
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
                    <PermitItem
                      key={permit.id}
                      permit={permit}
                      onAction={handleGeneratedPermitAction}
                      isCopied={isCopied}
                    />
                  ))}
                </div>
              )}
            </AccordionSection>

            <AccordionSection
              id="received"
              triggerClassName="flex w-full items-center justify-between text-left text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
              contentClassName="mt-4"
              renderHeader={(isOpen: boolean) => (
                <>
                  <span>Received</span>
                  {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                </>
              )}
            >
              {receivedPermits.length === 0 ? (
                <div className="pl-1 text-sm text-[#0E2F3F]/70 dark:text-white/80">No permits yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {receivedPermits.map((permit) => (
                    <PermitItem
                      key={permit.id}
                      permit={permit}
                      onAction={() => handleReceivedPermitDelete(permit.id)}
                    />
                  ))}
                </div>
              )}
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
