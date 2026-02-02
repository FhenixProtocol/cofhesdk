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
import { InfoModalButton } from '@/components/FnxFloatingButton/modals/InfoModalButton.js';
import { usePortalModals } from '@/stores';
import { PortalModal } from '@/components/FnxFloatingButton/modals/types.js';

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
    selfPermits,
    delegatedPermits,
    importedPermits,
    isCopied,
    handleQuickAction,
    handleCopy,
    handleDelete,
    handlePermitSelect,
    navigateBack,
  } = usePermitsList();
  const { openModal } = usePortalModals();

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
          <Accordion defaultActiveId="self">
            <div className="flex flex-col gap-3">
              <AccordionSection
                id="self"
                renderHeader={() => (
                  <>
                    <span>Self:</span>{' '}
                    <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeExplanation, { type: 'self' })} />
                  </>
                )}
              >
                {selfPermits.length === 0 ? (
                  <div className="pl-4 text-sm text-[#0E2F3F]/70 dark:text-white/80">No permits yet.</div>
                ) : (
                  <div>
                    {selfPermits.map(({ permit, hash }) => {
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
                id="delegated"
                renderHeader={() => (
                  <>
                    <span>Delegated:</span>{' '}
                    <InfoModalButton
                      onClick={() => openModal(PortalModal.PermitTypeExplanation, { type: 'sharing' })}
                    />
                  </>
                )}
              >
                {delegatedPermits.length === 0 ? (
                  <div className="pl-1 text-sm text-[#0E2F3F]/70 dark:text-white/80">No permits yet.</div>
                ) : (
                  <div>
                    {delegatedPermits.map(({ permit, hash }) => (
                      <PermitItem key={hash} hash={hash} permit={permit} onSelect={() => handlePermitSelect(hash)} />
                    ))}
                  </div>
                )}
              </AccordionSection>

              <AccordionSection
                id="received"
                renderHeader={() => (
                  <>
                    <span>Imported:</span>{' '}
                    <InfoModalButton
                      onClick={() => openModal(PortalModal.PermitTypeExplanation, { type: 'recipient' })}
                    />
                  </>
                )}
              >
                {importedPermits.length === 0 ? (
                  <div className="pl-1 text-sm text-[#0E2F3F]/70 dark:text-white/80">No permits yet.</div>
                ) : (
                  <div>
                    {importedPermits.map(({ permit, hash }) => (
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
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              onClick={() => handleQuickAction(id)}
              icon={<Icon />}
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
