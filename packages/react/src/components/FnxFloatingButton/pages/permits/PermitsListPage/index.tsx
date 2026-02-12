import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { FaKey, FaDownload, FaPlus } from 'react-icons/fa';
import { type ElementType } from 'react';
import { Accordion, AccordionSection } from '../../../Accordion.js';
import { PermitItem } from '../components/PermitItem.js';
import { usePermitsList } from '@/hooks/permits/index.js';
import type { PermitActionId } from '@/hooks/permits/index.js';
import { PageContainer } from '@/components/FnxFloatingButton/components/PageContainer.js';
import { useCofheActivePermit } from '@/hooks/useCofhePermits.js';
import type { Permit } from '@cofhe/sdk/permits';
import { Button } from '@/components/FnxFloatingButton/components/Button.js';
import { InfoModalButton } from '@/components/FnxFloatingButton/modals/InfoModalButton.js';
import { usePortalModals, usePortalNavigation } from '@/stores';
import { PortalModal } from '@/components/FnxFloatingButton/modals/types.js';
import { PermitCard } from '@/components/FnxFloatingButton/components/PermitCard.js';

type PermitActionItem = { id: PermitActionId; label: string; icon: ElementType };

const permitActions: PermitActionItem[] = [
  { id: 'generate', label: 'Generate', icon: FaPlus },
  { id: 'delegate', label: 'Delegate', icon: FaKey },
  { id: 'import', label: 'Import', icon: FaDownload },
];

type Args = {
  generatedPermitsCount: number;
  receivedPermitsCount: number;
  activePermit?: Permit;
};

function computeDefaultActiveAccordionId({ activePermit }: Args): 'self' | 'received' {
  if (activePermit?.type === 'recipient') {
    return 'received';
  }
  return 'self';
}

export const PermitsListPage: React.FC = () => {
  const { activePermitHash, selfPermits, delegatedPermits, importedPermits, handlePermitAction, handleOpenPermit } =
    usePermitsList();
  const { navigateBack } = usePortalNavigation();
  const { openModal } = usePortalModals();

  const { permit } = useCofheActivePermit() ?? {};

  const defaultActiveAccordionId = computeDefaultActiveAccordionId({
    generatedPermitsCount: selfPermits.length,
    receivedPermitsCount: importedPermits.length,
    activePermit: permit,
  });

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
          <Accordion defaultActiveId={defaultActiveAccordionId}>
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
                          onClick={() => handleOpenPermit(hash)}
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
                      <PermitItem key={hash} hash={hash} permit={permit} onClick={() => handleOpenPermit(hash)} />
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
                        onClick={() => handleOpenPermit(hash)}
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
          {permitActions.map(({ id, label, icon: Icon }) => (
            <Button key={id} onClick={() => handlePermitAction(id)} icon={<Icon />} iconPosition="top" label={label} />
          ))}
        </div>
      }
    />
  );
};
