import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { usePermitDetailsPage } from '@/hooks/permits/index.js';

export type PermitDetailsPageProps = {
  selectedPermitHash: string;
};

export const PermitDetailsPage: React.FC<PermitDetailsPageProps> = ({ selectedPermitHash }) => {
  const {
    permitLabel,
    permitJson,
    expirationInfo,
    expirationDate,
    handleBack,
    handleCopy,
    handleViewAs,
    hasSelection,
    isCopyComplete,
    isActivePermit,
    isShareablePermit,
  } = usePermitDetailsPage(selectedPermitHash);

  if (!hasSelection) {
    return (
      <div className="fnx-text-primary text-sm">
        <div className="rounded-2xl border border-[#154054] bg-white p-5 text-center shadow-[0_25px_60px_rgba(13,53,71,0.15)] dark:border-[#2C6D80] dark:bg-[#1F1F1F]">
          <p className="text-base font-semibold text-[#0E2F3F] dark:text-white">No permit selected</p>
          <p className="mt-1 text-sm text-[#0E2F3F]/70 dark:text-white/70">
            Choose a permit from the list to view its details.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[#0E2F3F] px-4 py-2 text-sm font-semibold text-[#0E2F3F] transition-colors hover:bg-[#0E2F3F]/10 dark:border-white/70 dark:text-white dark:hover:bg-white/10"
            onClick={handleBack}
          >
            <ArrowBackIcon fontSize="small" />
            <span>Back to permits</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fnx-text-primary text-sm">
      <div className="rounded-2xl border border-[#154054] bg-white p-5 shadow-[0_25px_60px_rgba(13,53,71,0.15)] transition-colors dark:border-[#2C6D80] dark:bg-[#1F1F1F]">
        <div className="flex items-center justify-between pb-4">
          <button
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
            onClick={handleBack}
            type="button"
          >
            <ArrowBackIcon fontSize="small" />
            <span>{permitLabel ?? 'Permit details'}</span>
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between text-sm font-semibold text-[#0E2F3F] dark:text-white">
              <span>Permit data</span>
              {isShareablePermit ? (
                <button
                  type="button"
                  className="rounded-md border border-[#0E2F3F]/30 p-1.5 text-[#0E2F3F] transition-colors hover:bg-[#0E2F3F]/10 dark:border-white/30 dark:text-white dark:hover:bg-white/10"
                  onClick={handleCopy}
                  aria-label={isCopyComplete ? 'Copied permit data' : 'Copy permit data'}
                  title={isCopyComplete ? 'Copied permit data' : 'Copy permit data'}
                >
                  {isCopyComplete ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </button>
              ) : null}
            </div>
            <div className="mt-3 rounded-xl border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80">
              <pre className="max-h-60 whitespace-pre-wrap break-words text-left">{permitJson}</pre>
            </div>
          </div>

          <div className="rounded-xl border border-[#0E2F3F]/15 bg-[#EEF6F8] p-4 dark:border-white/10 dark:bg-[#102027]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0E2F3F]/70 dark:text-white/70">
              Expiring in
            </p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                expirationInfo.expired ? 'text-[#D14324]' : 'text-[#0E2F3F] dark:text-white'
              }`}
            >
              {expirationInfo.label}
            </p>
            {expirationDate ? (
              <p className="mt-1 text-xs text-[#0E2F3F]/70 dark:text-white/70">
                {expirationInfo.expired ? 'Expired on' : 'Expires on'} {expirationDate}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="w-full rounded-xl border border-[#68D8EB] bg-[#A8F3FB] px-4 py-3 text-base font-semibold text-[#00314E] transition-colors hover:bg-[#90edf7] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1F6B7D] dark:bg-[#114C5A] dark:text-white dark:hover:bg-[#0f3f4b]"
            onClick={handleViewAs}
            disabled={isActivePermit}
          >
            {isActivePermit ? 'Active permit' : 'View as'}
          </button>
        </div>
      </div>
    </div>
  );
};
