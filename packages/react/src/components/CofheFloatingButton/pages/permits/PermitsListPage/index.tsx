import { ArrowBackIcon } from '@/components/Icons';
import { FaKey, FaDownload, FaPlus } from 'react-icons/fa';
import { type ElementType } from 'react';
import { Accordion, AccordionSection } from '../../../Accordion.js';
import { PermitItem } from '../components/PermitItem.js';
import { usePermitsList, useIncomingShares } from '@/hooks/permits/index.js';
import type { PermitActionId } from '@/hooks/permits/index.js';
import { PageContainer } from '@/components/CofheFloatingButton/components/PageContainer.js';
import { useCofheActivePermit } from '@/hooks/useCofhePermits.js';
import type { ACP } from '@cofhe/sdk/permits';
import { Button } from '@/components/CofheFloatingButton/components/Button.js';
import { InfoModalButton } from '@/components/CofheFloatingButton/modals/InfoModalButton.js';
import { usePortalModals, usePortalNavigation } from '@/stores';
import { PortalModal } from '@/components/CofheFloatingButton/modals/types.js';
import { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types.js';
import { PermitCard } from '@/components/CofheFloatingButton/components/PermitCard.js';

type PermitActionItem = { id: PermitActionId; label: string; icon: ElementType };

const permitActions: PermitActionItem[] = [
  { id: 'generate', label: 'Generate', icon: FaPlus },
  { id: 'delegate', label: 'Delegate', icon: FaKey },
  { id: 'import', label: 'Import', icon: FaDownload },
];

type Args = {
  generatedPermitsCount: number;
  receivedPermitsCount: number;
  activePermit?: ACP;
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
  const { navigateBack, navigateTo } = usePortalNavigation();
  const incomingShares = useIncomingShares();
  const incomingCount = incomingShares.data?.length ?? 0;
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
          <div className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] dark:text-white">
            <button
              className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
              onClick={navigateBack}
              type="button"
            >
              <ArrowBackIcon fontSize="small" />
              <span>Permits</span>
            </button>
            <InfoModalButton onClick={() => openModal(PortalModal.PermitInfo)} />
          </div>
          {activePermitHash != null && (
            <PermitCard
              hash={activePermitHash}
              className="-ml-4 -mr-4"
              header={<p className="text-sm font-semibold">Active ACP:</p>}
            />
          )}
        </div>
      }
      content={
        <div className="gap-4">
          {incomingCount > 0 && (
            <button
              type="button"
              className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#0E2F3F]/20 bg-[#F8FAFB] px-4 py-3 text-sm font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:border-white/15 dark:bg-[#121212] dark:text-white"
              onClick={() => navigateTo(FloatingButtonPage.IncomingShares)}
            >
              <span>
                Incoming on-chain shares <b>({incomingCount})</b>
              </span>
              <span aria-hidden>→</span>
            </button>
          )}
          <Accordion defaultActiveId={defaultActiveAccordionId}>
            <div className="flex flex-col gap-3">
              <AccordionSection
                id="self"
                renderHeader={() => <span>Self: ({selfPermits.length})</span>}
                accessory={<InfoModalButton onClick={() => openModal(PortalModal.PermitTypeInfo, { type: 'self' })} />}
              >
                {selfPermits.length === 0 ? (
                  <div className="pl-4 text-xs p-2 px-4 italic">No self permits.</div>
                ) : (
                  <div>
                    {selfPermits.map((permit) => {
                      return (
                        <PermitItem
                          key={permit.hash}
                          activePermitHash={activePermitHash}
                          permit={permit}
                          onClick={() => handleOpenPermit(permit.hash)}
                        />
                      );
                    })}
                  </div>
                )}
              </AccordionSection>

              <AccordionSection
                id="delegated"
                renderHeader={() => <span>Delegated: ({delegatedPermits.length})</span>}
                accessory={
                  <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeInfo, { type: 'sharing' })} />
                }
              >
                {delegatedPermits.length === 0 ? (
                  <div className="pl-1 text-xs p-2 px-4 italic">No delegated permits.</div>
                ) : (
                  <div>
                    {delegatedPermits.map((permit) => (
                      <PermitItem key={permit.hash} permit={permit} onClick={() => handleOpenPermit(permit.hash)} />
                    ))}
                  </div>
                )}
              </AccordionSection>

              <AccordionSection
                id="received"
                renderHeader={() => <span>Imported: ({importedPermits.length})</span>}
                accessory={
                  <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeInfo, { type: 'recipient' })} />
                }
              >
                {importedPermits.length === 0 ? (
                  <div className="pl-1 text-xs p-2 px-4 italic">No imported permits.</div>
                ) : (
                  <div>
                    {importedPermits.map((permit) => (
                      <PermitItem
                        key={permit.hash}
                        activePermitHash={activePermitHash}
                        permit={permit}
                        onClick={() => handleOpenPermit(permit.hash)}
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
