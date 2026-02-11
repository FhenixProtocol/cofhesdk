import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PermitReceiveIcon from '@/assets/fhenix-permit-receive.svg';
import { useReceivePermit } from '@/hooks/permits/index.js';
import { usePortalNavigation, usePortalToasts } from '@/stores';
import { PageContainer } from '@/components/FnxFloatingButton/components/PageContainer';
import { Button } from '@/components/FnxFloatingButton/components/Button.js';
import { BasePermitCard } from '@/components/FnxFloatingButton/components/PermitCard.js';

export const ImportPermitPage: React.FC = () => {
  const { navigateBack } = usePortalNavigation();
  const { addToast } = usePortalToasts();
  
  const {
    importedPermit,
    permitData,
    setPermitData,
    permitName,
    setPermitName,
    isSubmitting,
    errorMsg,
    successMsg,
    submit,
  } = useReceivePermit({
    onSuccess: () => {
      navigateBack();
      addToast({
        variant: 'success',
        title: 'Permit imported',
      });
    },
    onError: (error) => {
      addToast({
        variant: 'error',
        title: 'Failed to import permit',
        description: error.message,
      });
      console.error('Error importing permit', error);
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
          <span>Import permit</span>
        </button>
      }
      content={
        <div className="flex flex-col w-full gap-3">
          <div className="flex items-center gap-3 text-[#0E2F3F] dark:text-white">
            <div className="flex items-center justify-center rounded-lg border border-[#0E2F3F]/30 p-2 dark:border-white/40">
              <PermitReceiveIcon className="h-7 w-7 fill-inherit" aria-label="CoFHE import permit icon" />
            </div>
            <div className="text-lg font-semibold">CoFHE Permits</div>
          </div>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            This form importes a permit that has been shared with you.
            <br />
            Paste the permit data into the input below to import it.
          </p>

          {importedPermit == null && (
            <textarea
              id="fnx-permit-data"
              rows={8}
              placeholder="Paste permit data"
              className="w-full border border-[#0E2F3F]/30 bg-[#F4F6F8] px-4 py-3 text-sm text-[#0E2F3F] outline-none transition focus:border-[#0EA5A7] dark:border-white/30 dark:bg-transparent dark:text-white dark:placeholder:text-white/50"
              value={permitData}
              onChange={(e) => setPermitData(e.target.value)}
            />
          )}

          {importedPermit != null && (
            <>
              <div className="gap-2">
                <label className="text-sm font-semibold text-[#0E2F3F] dark:text-white" htmlFor="fnx-permit-name">
                  Imported Permit:
                </label>
                <BasePermitCard permit={importedPermit} />
              </div>
              <div className="gap-2">
                <label className="text-sm font-semibold text-[#0E2F3F] dark:text-white" htmlFor="fnx-permit-name">
                  Name override:
                </label>
                <input
                  id="fnx-permit-name"
                  type="text"
                  placeholder={importedPermit.name ?? 'Permit name...'}
                  className="w-full rounded-xl border border-[#0E2F3F]/30 bg-[#F4F6F8] px-4 py-3 text-sm text-[#0E2F3F] outline-none transition focus:border-[#0EA5A7] dark:border-white/30 dark:bg-transparent dark:text-white dark:placeholder:text-white/50"
                  value={permitName}
                  onChange={(e) => setPermitName(e.target.value)}
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
              {isSubmitting ? 'Importing...' : 'Import Permit'}
            </Button>
          </div>
        </div>
      }
    />
  );
};
