import { ArrowBackIcon } from '@/components/Icons';
import { FaKey, FaDownload, FaPlus } from 'react-icons/fa';
import { type ElementType } from 'react';
import { Accordion, AccordionSection } from '../../../Accordion.js';
import { ACPItem } from '../components/ACPItem.js';
import { useACPsList, useIncomingShares } from '@/hooks/acps/index.js';
import type { ACPActionId } from '@/hooks/acps/index.js';
import { PageContainer } from '@/components/CofheFloatingButton/components/PageContainer.js';
import { useCofheActiveACP } from '@/hooks/useCofheACPs.js';
import type { ACP } from '@cofhe/sdk/acps';
import { Button } from '@/components/CofheFloatingButton/components/Button.js';
import { InfoModalButton } from '@/components/CofheFloatingButton/modals/InfoModalButton.js';
import { usePortalModals, usePortalNavigation } from '@/stores';
import { PortalModal } from '@/components/CofheFloatingButton/modals/types.js';
import { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types.js';
import { ACPCard } from '@/components/CofheFloatingButton/components/ACPCard.js';

type ACPActionItem = { id: ACPActionId; label: string; icon: ElementType };

const acpActions: ACPActionItem[] = [
  { id: 'generate', label: 'Generate', icon: FaPlus },
  { id: 'delegate', label: 'Delegate', icon: FaKey },
  { id: 'import', label: 'Import', icon: FaDownload },
];

type Args = {
  generatedACPsCount: number;
  receivedACPsCount: number;
  activeACP?: ACP;
};

function computeDefaultActiveAccordionId({ activeACP }: Args): 'self' | 'received' {
  if (activeACP?.type === 'recipient') {
    return 'received';
  }
  return 'self';
}

export const ACPsListPage: React.FC = () => {
  const { activeACPHash, selfACPs, delegatedACPs, importedACPs, handleACPAction, handleOpenACP } = useACPsList();
  const { navigateBack, navigateTo } = usePortalNavigation();
  const incomingShares = useIncomingShares();
  const incomingCount = incomingShares.data?.length ?? 0;
  const { openModal } = usePortalModals();

  const { acp } = useCofheActiveACP() ?? {};

  const defaultActiveAccordionId = computeDefaultActiveAccordionId({
    generatedACPsCount: selfACPs.length,
    receivedACPsCount: importedACPs.length,
    activeACP: acp,
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
              <span>ACPs</span>
            </button>
            <InfoModalButton onClick={() => openModal(PortalModal.ACPInfo)} />
          </div>
          {activeACPHash != null && (
            <ACPCard
              hash={activeACPHash}
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
                renderHeader={() => <span>Self: ({selfACPs.length})</span>}
                accessory={<InfoModalButton onClick={() => openModal(PortalModal.ACPTypeInfo, { type: 'self' })} />}
              >
                {selfACPs.length === 0 ? (
                  <div className="pl-4 text-xs p-2 px-4 italic">No self acps.</div>
                ) : (
                  <div>
                    {selfACPs.map((acp) => {
                      return (
                        <ACPItem
                          key={acp.hash}
                          activeACPHash={activeACPHash}
                          acp={acp}
                          onClick={() => handleOpenACP(acp.hash)}
                        />
                      );
                    })}
                  </div>
                )}
              </AccordionSection>

              <AccordionSection
                id="delegated"
                renderHeader={() => <span>Delegated: ({delegatedACPs.length})</span>}
                accessory={<InfoModalButton onClick={() => openModal(PortalModal.ACPTypeInfo, { type: 'sharing' })} />}
              >
                {delegatedACPs.length === 0 ? (
                  <div className="pl-1 text-xs p-2 px-4 italic">No delegated acps.</div>
                ) : (
                  <div>
                    {delegatedACPs.map((acp) => (
                      <ACPItem key={acp.hash} acp={acp} onClick={() => handleOpenACP(acp.hash)} />
                    ))}
                  </div>
                )}
              </AccordionSection>

              <AccordionSection
                id="received"
                renderHeader={() => <span>Imported: ({importedACPs.length})</span>}
                accessory={
                  <InfoModalButton onClick={() => openModal(PortalModal.ACPTypeInfo, { type: 'recipient' })} />
                }
              >
                {importedACPs.length === 0 ? (
                  <div className="pl-1 text-xs p-2 px-4 italic">No imported acps.</div>
                ) : (
                  <div>
                    {importedACPs.map((acp) => (
                      <ACPItem
                        key={acp.hash}
                        activeACPHash={activeACPHash}
                        acp={acp}
                        onClick={() => handleOpenACP(acp.hash)}
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
          {acpActions.map(({ id, label, icon: Icon }) => (
            <Button key={id} onClick={() => handleACPAction(id)} icon={<Icon />} iconPosition="top" label={label} />
          ))}
        </div>
      }
    />
  );
};
