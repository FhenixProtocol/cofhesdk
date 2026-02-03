import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { FaKey, FaDownload, FaPlus } from 'react-icons/fa';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { ElementType, FC } from 'react';
import { Accordion, AccordionSection } from '../../../Accordion.js';
import { PermitItem } from '../components/PermitItem.js';
import { usePermitsList } from '@/hooks/permits/index.js';
import type { QuickActionId } from '@/hooks/permits/index.js';
import { PageContainer } from '@/components/FnxFloatingButton/components/PageContainer.js';
import { Button } from '@/components/FnxFloatingButton/components/Button.js';
import { InfoModalButton } from '@/components/FnxFloatingButton/modals/InfoModalButton.js';
import { usePortalModals } from '@/stores';
import { PortalModal } from '@/components/FnxFloatingButton/modals/types.js';
import { PermitCard } from '@/components/FnxFloatingButton/components/PermitCard.js';

type QuickAction = { id: QuickActionId; label: string; icon: ElementType };

const quickActions: QuickAction[] = [
  { id: 'generate', label: 'Generate', icon: FaPlus },
  { id: 'delegate', label: 'Delegate', icon: FaKey },
  { id: 'import', label: 'import', icon: FaDownload },
];

export const PermitsListPage: React.FC = () => {
  const {
    activePermitHash,
    selfPermits,
    delegatedPermits,
    importedPermits,
    handleQuickAction,
    handlePermitSelect,
    navigateBack,
  } = usePermitsList();
  const { openModal } = usePortalModals();

  return (
    <PageContainer
      header={
        <div className="flex flex-col gap-3">
          <button
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
            onClick={navigateBack}
            type="button"
          >
            <ArrowBackIcon fontSize="small" />
            <span>Permits</span>
            <InfoModalButton onClick={() => openModal(PortalModal.PermitInfo)} />
          </button>
          {activePermitHash != null && (
            <PermitCard
              hash={activePermitHash}
              className="-ml-4 -mr-4"
              header={<p className="text-sm font-semibold">Active Permit:</p>}
            />
          )}
        </div>
      }
      content={
        <div className="gap-4">
          <Accordion defaultActiveId="self">
            <div className="flex flex-col gap-3">
              <AccordionSection
                id="self"
                renderHeader={() => (
                  <>
                    <span>Self: ({selfPermits.length})</span>{' '}
                    <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeInfo, { type: 'self' })} />
                  </>
                )}
              >
                {selfPermits.length === 0 ? (
                  <div className="pl-4 text-xs p-2 px-4 italic">No self permits.</div>
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
                    <span>Delegated: ({delegatedPermits.length})</span>{' '}
                    <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeInfo, { type: 'sharing' })} />
                  </>
                )}
              >
                {delegatedPermits.length === 0 ? (
                  <div className="pl-1 text-xs p-2 px-4 italic">No delegated permits.</div>
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
                    <span>Imported: ({importedPermits.length})</span>{' '}
                    <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeInfo, { type: 'recipient' })} />
                  </>
                )}
              >
                {importedPermits.length === 0 ? (
                  <div className="pl-1 text-xs p-2 px-4 italic">No imported permits.</div>
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
            <Button key={id} onClick={() => handleQuickAction(id)} icon={<Icon />} iconPosition="top" label={label} />
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
