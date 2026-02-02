import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { FaKey, FaDownload, FaPlus } from 'react-icons/fa';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { type ElementType, type FC } from 'react';
import { Accordion, AccordionSection } from '../../../Accordion.js';
import { PermitItem } from './components/PermitItem';
import { usePermitsList } from '@/hooks/permits/index.js';
import type { QuickActionId } from '@/hooks/permits/index.js';
import { PageContainer } from '@/components/FnxFloatingButton/components/PageContainer.js';
import { useCofheActivePermit } from '@/hooks/useCofhePermits.js';
import type { Permit } from '@cofhe/sdk/permits';
import { Button } from '@/components/FnxFloatingButton/components/Button.js';

type QuickAction = { id: QuickActionId; label: string; icon: ElementType };

const quickActions: QuickAction[] = [
  { id: 'generate', label: 'Generate', icon: FaPlus },
  { id: 'delegate', label: 'Delegate', icon: FaKey },
  { id: 'import', label: 'import', icon: FaDownload },
];

type Args = {
  generatedPermitsCount: number;
  receivedPermitsCount: number;
  activePermit?: Permit;
};
function computeDefaultActiveAccordionId({
  generatedPermitsCount,
  receivedPermitsCount,
  activePermit,
}: Args): 'generated' | 'received' {
  if (activePermit?.type === 'recipient') {
    return 'received';
  }
  if (generatedPermitsCount > 0 || receivedPermitsCount === 0) {
    return 'generated';
  }
  return 'received';
}

export const PermitsListPage: React.FC = () => {
  const {
    activePermitHash,
    generatedPermits,
    receivedPermits,
    isCopied,
    handleQuickAction,
    handleCopy,
    handleDelete,
    handlePermitSelect,
    navigateBack,
  } = usePermitsList();

  const { permit } = useCofheActivePermit() ?? {};

  const defaultActiveAccordionId = computeDefaultActiveAccordionId({
    generatedPermitsCount: generatedPermits.length,
    receivedPermitsCount: receivedPermits.length,
    activePermit: permit,
  });

  return (
    <PageContainer
      header={
        <button
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
          onClick={navigateBack}
          type="button"
        >
          <ArrowBackIcon fontSize="small" />
          <span>Permit list</span>
        </button>
      }
      content={
        <div className="gap-4">
          <Accordion defaultActiveId="generated">
            <div className="flex flex-col gap-3">
              <AccordionSection
                id="generated"
                triggerClassName="flex w-full items-center justify-between text-left text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
                renderHeader={(isOpen: boolean) => (
                  <>
                    <span>Generated:</span>
                    {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                  </>
                )}
              >
                {generatedPermits.length === 0 ? (
                  <div className="pl-4 text-sm text-[#0E2F3F]/70 dark:text-white/80">No permits yet.</div>
                ) : (
                  <div>
                    {generatedPermits.map(({ permit, hash }) => {
                      return (
                        <PermitItem
                          key={hash}
                          activePermitHash={activePermitHash}
                          hash={hash}
                          permit={permit}
                          onSelect={() => handlePermitSelect(hash)}
                        />
                      );
                    })}
                  </div>
                )}
              </AccordionSection>

              <AccordionSection
                id="received"
                triggerClassName="flex w-full items-center justify-between text-left text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
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
                  <div>
                    {receivedPermits.map(({ permit, hash }) => (
                      <PermitItem
                        key={hash}
                        activePermitHash={activePermitHash}
                        hash={hash}
                        permit={permit}
                        onSelect={() => handlePermitSelect(hash)}
                      />
                    ))}
                  </div>
                )}
              </AccordionSection>
            </div>
          </Accordion>
        </div>
      }
      footer={
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              onClick={() => handleQuickAction(id)}
              icon={<Icon fontSize="small" />}
              iconPosition="top"
              label={label}
            />
          ))}
        </div>
      }
    />
  );
};

const BasePermitActionButton: FC<{
  ariaLabel: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ ariaLabel, title, disabled, onClick, children }) => (
  <button
    className="rounded-md border border-[#0E2F3F]/40 p-1.5 transition-colors hover:bg-[#0E2F3F]/10 dark:border-white/40 dark:hover:bg-white/10"
    aria-label={ariaLabel}
    type="button"
    title={title ?? ariaLabel}
    disabled={Boolean(disabled)}
    onClick={onClick}
  >
    {children}
  </button>
);

const CopyPermitActionButton: FC<{ copied: boolean; onClick: () => void }> = ({ copied, onClick }) => (
  <BasePermitActionButton ariaLabel={copied ? 'Copied!' : 'Copy permit'} disabled={copied} onClick={onClick}>
    {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
  </BasePermitActionButton>
);

const DeletePermitActionButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <BasePermitActionButton ariaLabel="Remove permit" title="Remove permit" onClick={onClick}>
    <DeleteOutlineIcon fontSize="small" />
  </BasePermitActionButton>
);
