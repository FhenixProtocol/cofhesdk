import { ArrowBackIcon } from '@/components/Icons';
import ACPReceiveIcon from '@/assets/fhenix-acp-receive.svg';
import { useReceiveACP } from '@/hooks/acps/index.js';
import { usePortalNavigation, usePortalToasts } from '@/stores';
import { PageContainer } from '@/components/CofheFloatingButton/components/PageContainer';
import { Button } from '@/components/CofheFloatingButton/components/Button.js';
import { BaseACPCard } from '@/components/CofheFloatingButton/components/ACPCard.js';
import { cofheLogger } from '@/utils/debug';

export const ImportACPPage: React.FC = () => {
  const { navigateBack } = usePortalNavigation();
  const { addToast } = usePortalToasts();

  const { importedACP, acpData, setACPData, acpName, setACPName, isSubmitting, errorMsg, successMsg, submit } =
    useReceiveACP({
      onSuccess: () => {
        navigateBack();
        addToast({
          variant: 'success',
          title: 'ACP imported',
        });
      },
      onError: (error) => {
        addToast({
          variant: 'error',
          title: 'Failed to import acp',
          description: error.message,
        });
        cofheLogger.error('Error importing acp', error);
      },
    });

  return (
    <PageContainer
      header={
        <button
          className="flex items-center gap-2 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
          type="button"
          onClick={navigateBack}
        >
          <ArrowBackIcon fontSize="small" />
          <span>Import acp</span>
        </button>
      }
      content={
        <div className="flex flex-col w-full gap-3">
          <div className="flex items-center gap-3 text-[#0E2F3F] dark:text-white">
            <div className="flex items-center justify-center rounded-lg border border-[#0E2F3F]/30 p-2 dark:border-white/40">
              <ACPReceiveIcon className="h-7 w-7 fill-inherit" aria-label="CoFHE import acp icon" />
            </div>
            <div className="text-lg font-semibold">CoFHE ACPs</div>
          </div>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            This form importes a acp that has been shared with you.
            <br />
            Paste the acp data into the input below to import it.
          </p>

          {importedACP == null && (
            <textarea
              id="cofhe-acp-data"
              rows={8}
              placeholder="Paste acp data"
              className="w-full border border-[#0E2F3F]/30 bg-[#F4F6F8] px-4 py-3 text-sm text-[#0E2F3F] outline-none transition focus:border-[#0EA5A7] dark:border-white/30 dark:bg-transparent dark:text-white dark:placeholder:text-white/50"
              value={acpData}
              onChange={(e) => setACPData(e.target.value)}
            />
          )}

          {importedACP != null && (
            <>
              <div className="gap-2">
                <label className="text-sm font-semibold text-[#0E2F3F] dark:text-white" htmlFor="cofhe-acp-name">
                  Imported ACP:
                </label>
                <BaseACPCard acp={importedACP} />
              </div>
              <div className="gap-2">
                <label className="text-sm font-semibold text-[#0E2F3F] dark:text-white" htmlFor="cofhe-acp-name">
                  Name override:
                </label>
                <input
                  id="cofhe-acp-name"
                  type="text"
                  placeholder={importedACP.name ?? 'ACP name...'}
                  className="w-full rounded-xl border border-[#0E2F3F]/30 bg-[#F4F6F8] px-4 py-3 text-sm text-[#0E2F3F] outline-none transition focus:border-[#0EA5A7] dark:border-white/30 dark:bg-transparent dark:text-white dark:placeholder:text-white/50"
                  value={acpName}
                  onChange={(e) => setACPName(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      }
      footer={
        <div className="flex flex-col w-full gap-2">
          {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}
          {successMsg && <div className="text-green-600 text-sm">{successMsg}</div>}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="default" onClick={navigateBack}>
              Cancel
            </Button>
            <Button variant="primary" disabled={isSubmitting} onClick={submit}>
              {isSubmitting ? 'Importing...' : 'Import ACP'}
            </Button>
          </div>
        </div>
      }
    />
  );
};
