import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';

const expiryOptions = ['1 day', '1 week', '1 month'];

export const GeneratePermitPage: React.FC = () => {
  const { navigateBack, darkMode } = useFnxFloatingButtonContext();
  const iconFill = darkMode ? '#FFFFFF' : '#00314E';

  return (
    <div className="fnx-text-primary text-sm">
      <div className="space-y-5 rounded-2xl border border-[#154054] bg-white p-5 shadow-[0_25px_60px_rgba(13,53,71,0.12)] transition-colors dark:border-[#2C6D80] dark:bg-[#1F1F1F]">
        <button
          className="flex items-center gap-2 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
          type="button"
          onClick={navigateBack}
        >
          <ArrowBackIcon fontSize="small" />
          <span>Generate new permit</span>
        </button>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[#0E2F3F] dark:text-white">
            <div className="flex items-center justify-center rounded-lg border border-[#0E2F3F]/30 p-2 dark:border-white/40">
              <svg
                width="19"
                height="22"
                viewBox="0 0 19 22"
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7"
                role="img"
                aria-label="CoFHE permit icon"
              >
                <path
                  d="M16 19V21.97H14V19H11V17H14V14H16V17H19V19H16ZM18 10C18 10.9 17.9 11.78 17.71 12.65C17.13 12.35 16.5 12.15 15.81 12.05C15.93 11.45 16 10.83 16 10.22V5.3L9 2.18L2 5.3V10.22C2 14.54 5.25 19 9 20L9.31 19.91C9.5 20.53 9.83 21.11 10.22 21.62L9 22C3.84 20.74 0 15.55 0 10V4L9 0L18 4V10Z"
                  fill={iconFill}
                />
              </svg>
            </div>
            <div className="text-lg font-semibold">Generate CoFHE Permit</div>
          </div>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            A permit is required to authenticate your identity and grant access to your encrypted data.
          </p>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            Generating a permit will open your wallet to sign a message (EIP712) which verifies your ownership of the connected wallet.
          </p>
        </div>

        <section className="space-y-3">
          <div className="rounded-2xl border border-[#0E2F3F]/30 dark:border-white/30">
            <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#0E2F3F]/70 dark:text-white/70">
              <span>Name</span>
              <label className="flex items-center gap-2 text-sm font-medium text-[#0E2F3F] dark:text-white">
                <span>Self permit</span>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-current">
                  <span className="h-2 w-2 bg-[#0E2F3F] dark:bg-white" />
                </span>
              </label>
            </div>
            <div className="border-t border-[#0E2F3F]/15 bg-[#F4F6F8] px-4 py-3 text-base font-semibold text-[#0E2F3F] dark:border-white/15 dark:bg-transparent dark:text-white">
              {'{Permit name}'}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-base font-semibold text-[#0E2F3F] dark:text-white">Expiring in:</p>
            <div className="grid grid-cols-3 gap-3">
              {expiryOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="rounded-xl border border-[#0E2F3F] px-4 py-3 text-base font-semibold text-[#0E2F3F] transition-colors hover:bg-[#0E2F3F]/5 dark:border-white/50 dark:text-white dark:hover:bg-white/10"
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#0E2F3F] dark:text-white">Or:</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 rounded-xl border border-[#0E2F3F]/40 bg-[#F4F6F8] px-4 py-3 text-base font-semibold text-[#0E2F3F] dark:border-white/30 dark:bg-transparent dark:text-white">
                  {'{Custom # of}'}
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[#0E2F3F]/40 px-4 py-3 text-base font-semibold text-[#0E2F3F] dark:border-white/40 dark:text-white">
                  <span>days</span>
                  <KeyboardArrowDownIcon fontSize="small" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            className="rounded-xl border border-[#F0784F] bg-[#F0784F] py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 dark:border-[#C8542D] dark:bg-[#C8542D]"
            onClick={navigateBack}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl border border-[#0EA5A7] bg-[#6ED8E1] py-3 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-90 dark:border-[#0EA5A7] dark:bg-[#0EA5A7] dark:text-white"
          >
            Generate / Delegate
          </button>
        </div>
      </div>
    </div>
  );
};
