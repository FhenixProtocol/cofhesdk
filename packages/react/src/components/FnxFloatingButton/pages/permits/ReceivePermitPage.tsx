import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PermitReceiveIcon from './assets/fhenix-permit-receive.svg';
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext.js';
import { useState } from 'react';
import { useCofheClient } from '../../../../hooks';

export const ReceivePermitPage: React.FC = () => {
  const { navigateBack, darkMode } = useFnxFloatingButtonContext();
  const client = useCofheClient();
  const [permitData, setPermitData] = useState('');
  const [permitName, setPermitName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const permitIconColor = darkMode ? '#FFFFFF' : '#00314E';

  const onSubmit = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!permitData.trim()) {
      setErrorMsg('Please paste permit data.');
      return;
    }
    try {
      setIsSubmitting(true);
      // Import shared permit from textarea content (JSON string or object)
      const result = await client.permits.importShared(permitData.trim());
      if (!result.success) {
        throw result.error;
      }
      // Optionally update name if provided (store already handles name from input data)
      setSuccessMsg('Permit received and set active.');
      // Navigate back to permits list
      navigateBack();
    } catch (err: any) {
      const message = err?.message ?? 'Failed to import permit';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="fnx-text-primary text-sm">
      <div className="space-y-5 rounded-2xl border border-[#154054] bg-white p-5 shadow-[0_25px_60px_rgba(13,53,71,0.15)] transition-colors dark:border-[#2C6D80] dark:bg-[#1F1F1F]">
        <button
          className="flex items-center gap-2 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
          type="button"
          onClick={navigateBack}
        >
          <ArrowBackIcon fontSize="small" />
          <span>Receive permit</span>
        </button>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[#0E2F3F] dark:text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#0E2F3F]/30 dark:border-white/40">
              <PermitReceiveIcon color={permitIconColor} />
            </div>
            <div className="text-lg font-semibold">Receive CoFHE Permit</div>
          </div>
          <div className="space-y-3 text-[#355366] dark:text-white/80">
            <p className="text-sm leading-relaxed">
              A permit is required to authenticate your identity and grant access to your encrypted data.
            </p>
            <p className="text-sm leading-relaxed">
              Receiving a permit will open your wallet to sign a message. Once signed your wallet is granted access.
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#0E2F3F] dark:text-white" htmlFor="fnx-permit-data">
              Permit data:
            </label>
            <textarea
              id="fnx-permit-data"
              rows={3}
              placeholder="Paste permit data"
              className="w-full rounded-xl border border-[#0E2F3F]/30 bg-[#F4F6F8] px-4 py-3 text-sm text-[#0E2F3F] outline-none transition focus:border-[#0EA5A7] dark:border-white/30 dark:bg-transparent dark:text-white dark:placeholder:text-white/50"
              value={permitData}
              onChange={(e) => setPermitData(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#0E2F3F] dark:text-white" htmlFor="fnx-permit-name">
              Name:
            </label>
            <input
              id="fnx-permit-name"
              type="text"
              placeholder="Add a permit name (optional)"
              className="w-full rounded-xl border border-[#0E2F3F]/30 bg-[#F4F6F8] px-4 py-3 text-sm text-[#0E2F3F] outline-none transition focus:border-[#0EA5A7] dark:border-white/30 dark:bg-transparent dark:text-white dark:placeholder:text-white/50"
              value={permitName}
              onChange={(e) => setPermitName(e.target.value)}
            />
          </div>
          {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}
          {successMsg && <div className="text-green-600 text-sm">{successMsg}</div>}
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
            className="rounded-xl border border-[#0EA5A7] bg-[#6ED8E1] py-3 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-90 dark:border-[#0EA5A7] dark:bg-[#0EA5A7] dark:text-white disabled:opacity-60"
            disabled={isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? 'Signing…' : 'Sign Permit'}
          </button>
        </div>
      </div>
    </div>
  );
};
